import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateSpainMadridPayroll, spainDescendantMinimums } from "../lib/calculations/legacy-engine.ts";

test("Spanish descendant minimums follow the state (AEAT) and Madrid amounts, shared between parents", () => {
  // 一人親・子ども3人（10歳・5歳・2歳）：国2,400＋2,700＋4,000＋2,800、州2,575.85＋2,897.83＋4,400＋3,005.16
  assert.deepEqual(spainDescendantMinimums([5, 2, 10], 1), { state: 2_400 + 2_700 + 4_000 + 2_800, regional: 2_575.85 + 2_897.83 + 4_400 + 3_005.16 });
  // 夫婦は半分ずつ。25歳以上の子は数えない
  assert.deepEqual(spainDescendantMinimums([12, 25], 0.5), { state: 1_200, regional: 2_575.85 / 2 });
  // 最低生活保障は税率表の下から差し引くため、子ども1人の一人親では国9.5%・州8.5%の分だけ税額が下がる（課税所得が十分ある場合）
  const base = calculateSpainMadridPayroll(50_000);
  const withChild = calculateSpainMadridPayroll(50_000, spainDescendantMinimums([10], 1));
  assert.ok(Math.abs(base.stateTax - withChild.stateTax - 2_400 * 0.095) < 0.01);
  assert.ok(Math.abs(base.regionalTax - withChild.regionalTax - 2_575.85 * 0.085) < 0.01);
  const tax = (household: "singleParent" | "family", ages: number[]) => calculateCity(cities.madrid, 50_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages } }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(tax("singleParent", [10]) < tax("family", [10]));
});
