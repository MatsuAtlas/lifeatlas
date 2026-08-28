import { FALLBACK_FX_TO_JPY } from "../../data/currencies.ts";
import type { CurrencyCode } from "../../types/city";
import type { ScenarioCalculationOptions, ScenarioInput, UserPriorities } from "../../types/scenario";
import type { WhatIfBreakEvenRequest, WhatIfChange, WhatIfSimulationInput, WhatIfSimulationResult, WhatIfSnapshot } from "../../types/what-if";
import { DEFAULT_PRIORITIES, scoreScenarios } from "../scoring/life-atlas-score.ts";
import { findBreakEvenSalary } from "./break-even.ts";
import { calculateScenario } from "./calculate-scenario.ts";

function assertPercent(name: string, percent: number, allowZeroResult = true) {
  const minimum = allowZeroResult ? -100 : -99.999999;
  if (!Number.isFinite(percent) || percent < minimum || percent > 1_000) {
    throw new RangeError(`${name} must be between ${minimum} and 1000.`);
  }
}

function scenarioById(scenarios: ScenarioInput[], scenarioId: string) {
  const index = scenarios.findIndex((scenario) => scenario.id === scenarioId);
  if (index < 0) throw new RangeError(`Unknown scenarioId: ${scenarioId}`);
  return index;
}

function calculateBreakEven(
  scenarios: ScenarioInput[],
  requests: WhatIfBreakEvenRequest[],
  priorities: UserPriorities,
  calculationOptions: ScenarioCalculationOptions,
) {
  return requests.map((request) => {
    const reference = scenarios.find((scenario) => scenario.id === request.referenceScenarioId);
    const candidate = scenarios.find((scenario) => scenario.id === request.candidateScenarioId);
    if (!reference || !candidate) throw new RangeError("Break-even request references an unknown scenario.");
    return findBreakEvenSalary({ reference, candidate, metric: request.metric, priorities, calculationOptions });
  });
}

function createSnapshot(
  inputs: ScenarioInput[],
  priorities: UserPriorities,
  calculationOptions: ScenarioCalculationOptions,
  breakEvenRequests: WhatIfBreakEvenRequest[],
): WhatIfSnapshot {
  const results = inputs.map((scenario) => calculateScenario(scenario, calculationOptions));
  return {
    inputs: inputs.map((scenario) => ({ ...scenario })),
    results,
    scores: scoreScenarios(results, priorities),
    breakEven: calculateBreakEven(inputs, breakEvenRequests, priorities, calculationOptions),
  };
}

function applyTargetedChange(
  scenarios: ScenarioInput[],
  change: Exclude<WhatIfChange, { type: "exchangeRatePercent" }>,
  calculationOptions: ScenarioCalculationOptions,
) {
  const index = scenarioById(scenarios, change.scenarioId);
  const current = scenarios[index];
  if (change.type === "annualSalary") scenarios[index] = { ...current, annualSalary: change.value };
  if (change.type === "salaryPercent") {
    assertPercent("salaryPercent", change.percent);
    scenarios[index] = { ...current, annualSalary: current.annualSalary * (1 + change.percent / 100) };
  }
  if (change.type === "rentPercent") {
    assertPercent("rentPercent", change.percent);
    const currentResult = calculateScenario(current, calculationOptions);
    scenarios[index] = { ...current, customRent: currentResult.rentMonthly * (1 + change.percent / 100) };
  }
  if (change.type === "household") scenarios[index] = { ...current, householdType: change.householdType };
  if (change.type === "children") scenarios[index] = { ...current, children: change.value };
  if (change.type === "customRent") scenarios[index] = { ...current, customRent: change.value ?? undefined };
  if (change.type === "customMonthlySpending") scenarios[index] = { ...current, customMonthlySpending: change.value ?? undefined };
  if (change.type === "customSavingsTarget") scenarios[index] = { ...current, customSavingsTarget: change.value ?? undefined };
  if (change.type === "retirementAge") scenarios[index] = { ...current, retirementAge: change.value };
  if (change.type === "annualReturnRate") scenarios[index] = { ...current, annualReturnRate: change.value };
}

export function simulateWhatIf(input: WhatIfSimulationInput): WhatIfSimulationResult {
  if (input.scenarios.length < 2 || input.scenarios.length > 5) throw new RangeError("What-If requires between 2 and 5 scenarios.");
  if (new Set(input.scenarios.map((scenario) => scenario.id)).size !== input.scenarios.length) throw new RangeError("Scenario IDs must be unique.");
  const priorities = input.priorities ?? DEFAULT_PRIORITIES;
  const breakEvenRequests = input.breakEven ?? [];
  const beforeRates = { ...FALLBACK_FX_TO_JPY, ...input.calculationOptions?.ratesToJpy };
  const beforeOptions: ScenarioCalculationOptions = { ...input.calculationOptions, ratesToJpy: beforeRates };
  const scenarios = input.scenarios.map((scenario) => ({ ...scenario }));
  const afterRates: Record<CurrencyCode, number> = { ...beforeRates };
  const before = createSnapshot(input.scenarios, priorities, beforeOptions, breakEvenRequests);

  for (const change of input.changes) {
    if (change.type === "exchangeRatePercent") {
      assertPercent("exchangeRatePercent", change.percent, false);
      afterRates[change.currency] *= 1 + change.percent / 100;
      continue;
    }
    applyTargetedChange(scenarios, change, { ...beforeOptions, ratesToJpy: afterRates });
  }

  const afterOptions: ScenarioCalculationOptions = { ...beforeOptions, ratesToJpy: afterRates };
  const after = createSnapshot(scenarios, priorities, afterOptions, breakEvenRequests);
  const deltas = before.results.map((beforeResult) => {
    const afterResult = after.results.find((result) => result.scenarioId === beforeResult.scenarioId);
    const beforeScore = before.scores.find((score) => score.scenarioId === beforeResult.scenarioId);
    const afterScore = after.scores.find((score) => score.scenarioId === beforeResult.scenarioId);
    if (!afterResult || !beforeScore || !afterScore) throw new Error("What-If result alignment failed.");
    return {
      scenarioId: beforeResult.scenarioId,
      annualSavings: beforeResult.annualSavings === null || afterResult.annualSavings === null ? null : afterResult.annualSavings - beforeResult.annualSavings,
      savingsRate: beforeResult.savingsRate === null || afterResult.savingsRate === null ? null : afterResult.savingsRate - beforeResult.savingsRate,
      projectedSavings10Years: beforeResult.projectedSavings10Years === null || afterResult.projectedSavings10Years === null ? null : afterResult.projectedSavings10Years - beforeResult.projectedSavings10Years,
      score: afterScore.score - beforeScore.score,
      rankChange: beforeScore.rank - afterScore.rank,
    };
  });

  return { before, after, deltas, appliedRatesToJpy: afterRates };
}
