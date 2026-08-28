import assert from "node:assert/strict";
import test from "node:test";

import { findBreakEvenSalary, solveMinimumThreshold } from "../lib/calculations/break-even.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const tokyo: ScenarioInput = {
  id: "tokyo-reference",
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
  id: "vancouver-candidate",
  cityId: "vancouver",
  annualSalary: 90_000,
  salaryCurrency: "CAD",
};

test("solves a reusable monotonic threshold without LLM reasoning", () => {
  const result = solveMinimumThreshold({ evaluate: (value) => value * 2 - 100, initialHigh: 10, max: 1_000, tolerance: 0.0001 });
  assert.equal(result.status, "matched");
  assert.ok(Math.abs((result.value ?? 0) - 50) <= 0.0001);
  assert.ok((result.achieved ?? -1) >= 0);
});

test("finds the Vancouver salary that matches Tokyo disposable income", () => {
  const result = findBreakEvenSalary({ reference: tokyo, candidate: vancouver, metric: "disposableIncome" });

  assert.equal(result.status, "matched");
  assert.equal(result.salaryCurrency, "CAD");
  assert.ok((result.requiredAnnualSalary ?? 0) > 0);
  assert.ok((result.achievedValue ?? 0) >= (result.referenceValue ?? Number.POSITIVE_INFINITY));
  assert.ok(result.iterations > 0);
});

test("supports savings-rate and LifeAtlas Score break-even targets", () => {
  for (const metric of ["savingsRate", "lifeAtlasScore"] as const) {
    const result = findBreakEvenSalary({ reference: tokyo, candidate: vancouver, metric });
    assert.equal(result.status, "matched");
    assert.ok((result.requiredAnnualSalary ?? 0) >= 0);
    assert.ok((result.achievedValue ?? 0) >= (result.referenceValue ?? Number.POSITIVE_INFINITY));
  }
});

test("keeps a fixed bonus explicit while solving base salary", () => {
  const result = findBreakEvenSalary({ reference: tokyo, candidate: { ...vancouver, bonus: 10_000 }, metric: "disposableIncome" });
  assert.equal(result.fixedBonus, 10_000);
  assert.equal(result.status, "matched");
});

test("reports unsupported and bounded-unreachable scenarios", () => {
  const unsupported = findBreakEvenSalary({
    reference: tokyo,
    candidate: { ...vancouver, id: "berlin", cityId: "berlin", salaryCurrency: "EUR" },
    metric: "disposableIncome",
  });
  assert.equal(unsupported.status, "calculation-unavailable");
  assert.equal(unsupported.requiredAnnualSalary, null);

  const unreachable = findBreakEvenSalary({ reference: tokyo, candidate: vancouver, metric: "disposableIncome", maxAnnualSalary: 1 });
  assert.equal(unreachable.status, "unreachable");
  assert.equal(unreachable.requiredAnnualSalary, null);
});

test("rejects ambiguous scenario identities and invalid search bounds", () => {
  assert.throws(() => findBreakEvenSalary({ reference: tokyo, candidate: { ...vancouver, id: tokyo.id }, metric: "savingsRate" }), /unique/);
  assert.throws(() => solveMinimumThreshold({ evaluate: (value) => value, initialHigh: 1, max: 0 }), /positive/);
});
