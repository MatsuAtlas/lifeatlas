import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculatePortugalPayroll, portugalDependantCredit } from "../lib/calculations/legacy-engine.ts";

test("Portuguese dependant credits follow CIRS art. 78-A and art. 13(5)", () => {
  // 一人親・子ども3人（10歳・5歳・2歳）：年上が1人目。€600×3＋2人目以降の6歳以下€300×2（€126とは重複しない）
  assert.equal(portugalDependantCredit([5, 2, 10], [], 1), 600 * 3 + 300 * 2);
  // 1人目が3歳以下なら€126
  assert.equal(portugalDependantCredit([3], [], 1), 726);
  // 夫婦は半分ずつ。26歳は数えず、18〜25歳は所得€920以下だけ
  assert.equal(portugalDependantCredit([26, 20, 21], [0, 920, 5_000], 0.5), 300);
  // 未成年は所得があっても数える
  assert.equal(portugalDependantCredit([17], [10_000], 1), 600);
});

test("the credit reduces normal tax but not below zero, and only for the regular regime", () => {
  close(calculatePortugalPayroll(40_000).incomeTax - calculatePortugalPayroll(40_000, 600).incomeTax, 600);
  assert.equal(calculatePortugalPayroll(14_000, 10_000).incomeTax, 0);
  const tax = (household: "singleParent" | "family", ages: number[]) => calculateCity(cities.lisbon, 40_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages } }).taxBreakdown!.incomeTaxMonthly * 12;
  close(tax("family", []) - tax("family", [10]), 300);
  close(tax("singleParent", []) - tax("singleParent", [10]), 600);
});

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
}
