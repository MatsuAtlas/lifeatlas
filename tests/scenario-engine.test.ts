import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario, householdModelFor, projectSavings } from "../lib/calculations/calculate-scenario.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const tokyoOffer: ScenarioInput = {
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

function assertClose(actual: number | null, expected: number, tolerance = 0.000001) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test("maps household and age inputs onto the existing calculation model", () => {
  assert.equal(householdModelFor({ householdType: "single", children: 0 }), "single");
  assert.equal(householdModelFor({ householdType: "single", children: 2 }), "singleParent");
  assert.equal(householdModelFor({ householdType: "couple", children: 1 }), "coupleOneChild");
  assert.equal(householdModelFor({ householdType: "couple", children: 2 }), "family");
  assert.equal(householdModelFor({ householdType: "couple", children: 3 }), "familyThreeChildren");
});

test("calculates a complete Offer Analyzer result from the existing engine", () => {
  const result = calculateScenario({ ...tokyoOffer, currentSavings: 1_000_000, customSavingsTarget: 10_000_000 });

  assert.equal(result.grossAnnual, 7_000_000);
  assert.equal(result.calculationStatus, "official-rate-estimate");
  assert.equal(result.taxAnnual, (result.taxBreakdown?.totalTaxMonthly ?? 0) * 12);
  assert.equal(result.socialInsuranceAnnual, (result.taxBreakdown?.totalInsuranceMonthly ?? 0) * 12);
  assert.equal(result.netAnnual, (result.netMonthly ?? 0) * 12);
  assert.equal(result.annualSavings, ((result.netMonthly ?? 0) - result.totalLivingCostMonthly) * 12);
  assertClose(result.projectedSavings5Years, 1_000_000 + (result.annualSavings ?? 0) * 5);
  assertClose(result.projectedSavings10Years, 1_000_000 + (result.annualSavings ?? 0) * 10);
  assert.equal(result.fire?.targetWealth, result.totalLivingCostAnnual * 25);
  assert.ok(result.savingsTargetYears !== null);
  assert.ok(result.dataConfidence.score >= 60);
});

test("keeps custom-spending deficits visible instead of clamping them to zero", () => {
  const result = calculateScenario({ ...tokyoOffer, customRent: 300_000, customMonthlySpending: 500_000 });

  assert.equal(result.rentMonthly, 300_000);
  assert.equal(result.baselineSpendingMonthly, 500_000);
  assert.ok((result.monthlySurplus ?? 0) < 0);
  assert.ok((result.annualSavings ?? 0) < 0);
  assert.ok((result.projectedSavings5Years ?? 0) < 0);
  assert.equal(result.fire?.yearsToTarget, null);
});

test("converts an offer currency before using the destination tax engine", () => {
  const result = calculateScenario({ ...tokyoOffer, annualSalary: 100_000, salaryCurrency: "CAD" });
  assert.equal(result.grossAnnual, 10_800_000);
  assert.equal(result.netAnnualJpy, result.netAnnual);
});

test("returns unavailable financial values and low confidence for unsupported tax cities", () => {
  const result = calculateScenario({ ...tokyoOffer, id: "berlin-offer", cityId: "berlin", salaryCurrency: "EUR", annualSalary: 70_000 });

  assert.equal(result.calculationStatus, "unavailable");
  assert.equal(result.unavailableReason, "tax");
  assert.equal(result.netAnnual, null);
  assert.equal(result.annualSavings, null);
  assert.equal(result.fire, null);
  assert.equal(result.dataConfidence.level, "low");
});

test("projects savings deterministically with an explicit return assumption", () => {
  assert.equal(projectSavings(1_000, 100, 2, 0.1), 1_420);
});
