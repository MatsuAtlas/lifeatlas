import type { BreakEvenInput, BreakEvenResult } from "../../types/break-even";
import type { ScenarioResult, UserPriorities } from "../../types/scenario";
import { DEFAULT_PRIORITIES, scoreScenarios } from "../scoring/life-atlas-score.ts";
import { calculateScenario } from "./calculate-scenario.ts";

type SearchResult = {
  status: "matched" | "unreachable" | "calculation-unavailable";
  value: number | null;
  achieved: number | null;
  iterations: number;
};

export function solveMinimumThreshold(options: {
  evaluate: (value: number) => number | null;
  initialHigh: number;
  max: number;
  tolerance?: number;
  maxIterations?: number;
}): SearchResult {
  if (!Number.isFinite(options.initialHigh) || options.initialHigh < 0) throw new RangeError("initialHigh must be non-negative.");
  if (!Number.isFinite(options.max) || options.max <= 0) throw new RangeError("max must be positive.");
  const tolerance = options.tolerance ?? 1;
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError("tolerance must be positive.");
  const maxIterations = options.maxIterations ?? 80;
  let iterations = 0;
  let low = 0;
  const lowResult = options.evaluate(low);
  iterations += 1;
  if (lowResult === null) return { status: "calculation-unavailable", value: null, achieved: null, iterations };
  if (lowResult >= 0) return { status: "matched", value: 0, achieved: lowResult, iterations };

  let high = Math.min(Math.max(options.initialHigh, tolerance), options.max);
  let highResult = options.evaluate(high);
  iterations += 1;
  if (highResult === null) return { status: "calculation-unavailable", value: null, achieved: null, iterations };
  while (highResult < 0 && high < options.max) {
    high = Math.min(high * 2, options.max);
    highResult = options.evaluate(high);
    iterations += 1;
    if (highResult === null) return { status: "calculation-unavailable", value: null, achieved: null, iterations };
  }
  if (highResult < 0) return { status: "unreachable", value: null, achieved: highResult, iterations };

  while (high - low > tolerance && iterations < maxIterations) {
    const midpoint = (low + high) / 2;
    const midpointResult = options.evaluate(midpoint);
    iterations += 1;
    if (midpointResult === null) return { status: "calculation-unavailable", value: null, achieved: null, iterations };
    if (midpointResult >= 0) {
      high = midpoint;
      highResult = midpointResult;
    } else {
      low = midpoint;
    }
  }
  return { status: "matched", value: high, achieved: highResult, iterations };
}

function metricValues(metric: BreakEvenInput["metric"], reference: ScenarioResult, candidate: ScenarioResult, priorities: UserPriorities) {
  if (metric === "disposableIncome") return [reference.netAnnualJpy, candidate.netAnnualJpy] as const;
  if (metric === "savingsRate") return [reference.savingsRate, candidate.savingsRate] as const;
  const scores = scoreScenarios([reference, candidate], priorities);
  return [
    scores.find((score) => score.scenarioId === reference.scenarioId)?.score ?? null,
    scores.find((score) => score.scenarioId === candidate.scenarioId)?.score ?? null,
  ] as const;
}

export function findBreakEvenSalary(input: BreakEvenInput): BreakEvenResult {
  if (input.reference.id === input.candidate.id) throw new RangeError("Reference and candidate scenario IDs must be unique.");
  const priorities = input.priorities ?? DEFAULT_PRIORITIES;
  const reference = calculateScenario(input.reference, input.calculationOptions);
  const evaluatePair = (annualSalary: number) => {
    const candidate = calculateScenario({ ...input.candidate, annualSalary }, input.calculationOptions);
    return { candidate, values: metricValues(input.metric, reference, candidate, priorities) };
  };
  const initialPair = evaluatePair(input.candidate.annualSalary);
  if (initialPair.values[0] === null || initialPair.values[1] === null) {
    return {
      status: "calculation-unavailable",
      metric: input.metric,
      referenceScenarioId: input.reference.id,
      candidateScenarioId: input.candidate.id,
      requiredAnnualSalary: null,
      salaryCurrency: input.candidate.salaryCurrency,
      fixedBonus: input.candidate.bonus ?? 0,
      referenceValue: initialPair.values[0],
      achievedValue: initialPair.values[1],
      iterations: 0,
    };
  }

  const maxAnnualSalary = input.maxAnnualSalary ?? Math.min(1_000_000_000_000, Math.max(input.candidate.annualSalary * 32, 1_000_000));
  const search = solveMinimumThreshold({
    evaluate: (annualSalary) => {
      const values = evaluatePair(annualSalary).values;
      if (values[0] === null) return null;
      return values[1] === null ? Number.NEGATIVE_INFINITY : values[1] - values[0];
    },
    initialHigh: Math.max(input.candidate.annualSalary, 1),
    max: maxAnnualSalary,
    tolerance: input.salaryTolerance ?? 1,
  });
  if (search.status !== "matched" || search.value === null) {
    return {
      status: search.status,
      metric: input.metric,
      referenceScenarioId: input.reference.id,
      candidateScenarioId: input.candidate.id,
      requiredAnnualSalary: null,
      salaryCurrency: input.candidate.salaryCurrency,
      fixedBonus: input.candidate.bonus ?? 0,
      referenceValue: initialPair.values[0],
      achievedValue: search.achieved === null || !Number.isFinite(search.achieved) ? null : initialPair.values[0] + search.achieved,
      iterations: search.iterations,
    };
  }

  const requiredAnnualSalary = Math.ceil(search.value);
  const finalValues = evaluatePair(requiredAnnualSalary).values;
  return {
    status: "matched",
    metric: input.metric,
    referenceScenarioId: input.reference.id,
    candidateScenarioId: input.candidate.id,
    requiredAnnualSalary,
    salaryCurrency: input.candidate.salaryCurrency,
    fixedBonus: input.candidate.bonus ?? 0,
    referenceValue: finalValues[0],
    achievedValue: finalValues[1],
    iterations: search.iterations,
  };
}
