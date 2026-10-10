import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { argentinaFamilyDeduction, calculateArgentinaPayroll, calculateCity } from "../lib/calculations/legacy-engine.ts";

test("Argentine family deductions follow ARCA's 2026 annual table with the extra one-twelfth", () => {
  close(argentinaFamilyDeduction([5, 12], true, 0), (5_669_323.06 + 2 * 2_859_060.31) * 13 / 12);
  // 0歳・18歳は数えない。最低課税所得を超える配偶者も数えない
  assert.equal(argentinaFamilyDeduction([0, 18], true), 0);
  assert.equal(argentinaFamilyDeduction([], false, 6_019_671.37), 0);
  close(argentinaFamilyDeduction([], false, 6_019_671.36), 5_669_323.06 * 13 / 12);
});

test("the deduction lowers taxable income; children count only when the user claims them", () => {
  const base = calculateArgentinaPayroll(49_000_000)!.incomeTax;
  assert.ok(calculateArgentinaPayroll(49_000_000, 1_000_000)!.incomeTax < base);
  const tax = (household: "singleParent" | "family", ages: number[], spouseSalary?: number) => calculateCity(cities.buenosAires, 49_000_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages, spouseSalary } })!.taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(tax("singleParent", [10]) < tax("singleParent", []));
  assert.equal(tax("family", [10], 20_000_000), tax("family", [], 20_000_000));
  assert.ok(tax("family", [], 0) < tax("family", [], 20_000_000));
});

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
}
