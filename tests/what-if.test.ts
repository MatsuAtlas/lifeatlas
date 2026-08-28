import assert from "node:assert/strict";
import test from "node:test";

import { FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { simulateWhatIf } from "../lib/calculations/what-if.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const tokyo: ScenarioInput = {
  id: "tokyo-offer",
  cityId: "tokyo",
  annualSalary: 7_000_000,
  salaryCurrency: "JPY",
  age: 29,
  householdType: "single",
  children: 0,
  housing: "onebed",
  lifestyle: "balanced",
};

const vancouver: ScenarioInput = {
  ...tokyo,
  id: "vancouver-offer",
  cityId: "vancouver",
  annualSalary: 90_000,
  salaryCurrency: "CAD",
};

function assertClose(actual: number | null, expected: number, tolerance = 0.000001) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test("recalculates salary, rent, wealth, score and rank without mutating source scenarios", () => {
  const scenarios = [tokyo, vancouver];
  const result = simulateWhatIf({
    scenarios,
    changes: [
      { type: "salaryPercent", scenarioId: vancouver.id, percent: 10 },
      { type: "rentPercent", scenarioId: vancouver.id, percent: 20 },
    ],
  });
  const beforeVancouver = result.before.results.find((item) => item.scenarioId === vancouver.id);
  const afterInput = result.after.inputs.find((item) => item.id === vancouver.id);
  const afterVancouver = result.after.results.find((item) => item.scenarioId === vancouver.id);
  const delta = result.deltas.find((item) => item.scenarioId === vancouver.id);
  const beforeScore = result.before.scores.find((item) => item.scenarioId === vancouver.id);
  const afterScore = result.after.scores.find((item) => item.scenarioId === vancouver.id);

  assert.equal(vancouver.annualSalary, 90_000);
  assert.equal(vancouver.customRent, undefined);
  assertClose(afterInput?.annualSalary ?? null, 99_000);
  assertClose(afterInput?.customRent ?? null, (beforeVancouver?.rentMonthly ?? 0) * 1.2);
  assert.notEqual(afterVancouver?.annualSavings, beforeVancouver?.annualSavings);
  assert.equal(delta?.score, (afterScore?.score ?? 0) - (beforeScore?.score ?? 0));
  assert.equal(delta?.rankChange, (beforeScore?.rank ?? 0) - (afterScore?.rank ?? 0));
  assert.notEqual(delta?.projectedSavings10Years, null);
  assert.deepEqual(scenarios, [tokyo, vancouver]);
});

test("applies household, child, spending, savings and FIRE assumption changes in order", () => {
  const result = simulateWhatIf({
    scenarios: [tokyo, vancouver],
    changes: [
      { type: "household", scenarioId: tokyo.id, householdType: "couple" },
      { type: "children", scenarioId: tokyo.id, value: 1 },
      { type: "customMonthlySpending", scenarioId: tokyo.id, value: 280_000 },
      { type: "customSavingsTarget", scenarioId: tokyo.id, value: 30_000_000 },
      { type: "retirementAge", scenarioId: tokyo.id, value: 62 },
      { type: "annualReturnRate", scenarioId: tokyo.id, value: 0.04 },
    ],
  });
  const afterInput = result.after.inputs.find((item) => item.id === tokyo.id);
  const afterResult = result.after.results.find((item) => item.scenarioId === tokyo.id);

  assert.equal(afterInput?.householdType, "couple");
  assert.equal(afterInput?.children, 1);
  assert.equal(afterInput?.customMonthlySpending, 280_000);
  assert.equal(afterInput?.customSavingsTarget, 30_000_000);
  assert.equal(afterInput?.retirementAge, 62);
  assert.equal(afterInput?.annualReturnRate, 0.04);
  assert.equal(afterResult?.assumptions.householdModel, "coupleOneChild");
  assert.equal(afterResult?.assumptions.annualReturnRate, 0.04);
});

test("recalculates JPY values with an explicit exchange-rate shock", () => {
  const result = simulateWhatIf({
    scenarios: [tokyo, vancouver],
    changes: [{ type: "exchangeRatePercent", currency: "CAD", percent: 10 }],
  });
  const beforeVancouver = result.before.results.find((item) => item.scenarioId === vancouver.id);
  const afterVancouver = result.after.results.find((item) => item.scenarioId === vancouver.id);

  assertClose(result.appliedRatesToJpy.CAD, FALLBACK_FX_TO_JPY.CAD * 1.1);
  assert.equal(afterVancouver?.annualSavings, beforeVancouver?.annualSavings);
  assertClose(afterVancouver?.annualSavingsJpy ?? null, (beforeVancouver?.annualSavingsJpy ?? 0) * 1.1);
});

test("compares break-even salary before and after a rent shock", () => {
  const result = simulateWhatIf({
    scenarios: [tokyo, vancouver],
    changes: [{ type: "rentPercent", scenarioId: vancouver.id, percent: 20 }],
    breakEven: [{ referenceScenarioId: tokyo.id, candidateScenarioId: vancouver.id, metric: "savingsRate" }],
  });
  const before = result.before.breakEven[0];
  const after = result.after.breakEven[0];

  assert.equal(before.status, "matched");
  assert.equal(after.status, "matched");
  assert.ok((after.requiredAnnualSalary ?? 0) > (before.requiredAnnualSalary ?? Number.POSITIVE_INFINITY));
});

test("resets custom overrides and rejects invalid What-If requests", () => {
  const reset = simulateWhatIf({
    scenarios: [{ ...tokyo, customRent: 250_000 }, vancouver],
    changes: [{ type: "customRent", scenarioId: tokyo.id, value: null }],
  });
  assert.equal(reset.after.inputs[0].customRent, undefined);

  assert.throws(() => simulateWhatIf({ scenarios: [tokyo], changes: [] }), /between 2 and 5/);
  assert.throws(() => simulateWhatIf({ scenarios: [tokyo, { ...vancouver, id: tokyo.id }], changes: [] }), /unique/);
  assert.throws(
    () => simulateWhatIf({ scenarios: [tokyo, vancouver], changes: [{ type: "salaryPercent", scenarioId: "missing", percent: 10 }] }),
    /Unknown scenarioId/,
  );
  assert.throws(
    () => simulateWhatIf({ scenarios: [tokyo, vancouver], changes: [{ type: "exchangeRatePercent", currency: "CAD", percent: -100 }] }),
    /exchangeRatePercent/,
  );
  assert.throws(
    () => simulateWhatIf({ scenarios: [tokyo, vancouver], changes: [{ type: "salaryPercent", scenarioId: tokyo.id, percent: -101 }] }),
    /salaryPercent/,
  );
});
