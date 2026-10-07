import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { japanChildAllowanceMonthly } from "../lib/calculations/child-allowance.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("Japanese child allowance follows the Children and Families Agency monthly amounts", () => {
  // 3歳未満15,000円、3歳以上高校生年代まで10,000円
  assert.equal(japanChildAllowanceMonthly([1]), 15_000);
  assert.equal(japanChildAllowanceMonthly([3, 10]), 20_000);
  // 12月31日時点の18歳は翌年3月31日まで高校生年代、19歳は対象外
  assert.equal(japanChildAllowanceMonthly([18]), 10_000);
  assert.equal(japanChildAllowanceMonthly([19]), 0);
  // 第3子以降は30,000円。22歳までの兄姉は年上から数える（23歳は数えない）
  assert.equal(japanChildAllowanceMonthly([12, 8, 2]), 10_000 + 10_000 + 30_000);
  assert.equal(japanChildAllowanceMonthly([21, 20, 5]), 30_000);
  assert.equal(japanChildAllowanceMonthly([23, 20, 5]), 10_000);
});

test("scenario results show the allowance for Japanese cities only and leave take-home unchanged", () => {
  const base: ScenarioInput = { id: "tokyo", cityId: "tokyo", annualSalary: 6_000_000, salaryCurrency: "JPY", age: 35, householdType: "couple", children: 2, housing: "twobed", lifestyle: "balanced" };
  const withAges = calculateScenario({ ...base, childrenAges: [1, 20] });
  assert.equal(withAges.childAllowance?.monthly, 15_000);
  assert.equal(withAges.childAllowance?.annual, 180_000);
  assert.equal(withAges.childAllowance?.countsOlderSiblingsAsSupported, true);
  assert.equal(calculateScenario(base).childAllowance, null);
  assert.equal(calculateScenario({ ...base, id: "berlin", cityId: "berlin", annualSalary: 60_000, salaryCurrency: "EUR", childrenAges: [1, 20] }).childAllowance, null);
});
