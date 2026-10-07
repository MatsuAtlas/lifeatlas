import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateKoreaPayroll, koreaFamilyRelief2026 } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("Korean family relief follows Income Tax Act articles 50, 51, 53 and 59-2 for 2026", () => {
  // 配偶者（給与500万ウォン以下）と子ども2人：基本控除3人分。子女税額控除は12月31日に10歳以上の1人だけ
  assert.deepEqual(koreaFamilyRelief2026({ spouseSalary: 5_000_000, childrenAges: [5, 12] }), { deduction: 4_500_000, childCredit: 250_000 });
  assert.equal(koreaFamilyRelief2026({ spouseSalary: 5_000_001 }).deduction, 0);
  // 20歳以下の日がある年（12月31日に21歳以下）まで基本控除。2026年分は9歳（2017年生まれ）を子女税額控除から除く
  assert.deepEqual(koreaFamilyRelief2026({ childrenAges: [9, 10, 21, 22], singleParent: true }), { deduction: 3 * 1_500_000 + 1_000_000, childCredit: 550_000 });
  // 3人目からは1人40万ウォン加算
  assert.equal(koreaFamilyRelief2026({ childrenAges: [10, 12, 14, 16] }).childCredit, 550_000 + 2 * 400_000);
  // 基本控除の対象となる子がいなければ一人親の追加控除はない
  assert.equal(koreaFamilyRelief2026({ childrenAges: [25], singleParent: true }).deduction, 0);
});

test("family relief lowers the Seoul income tax at the marginal rate plus the child credit", () => {
  const single = calculateKoreaPayroll(55_000_000);
  const family = calculateKoreaPayroll(55_000_000, { spouseSalary: 0, childrenAges: [5, 12] });
  // 課税標準が15%の区間にあり、勤労所得税額控除は上限のままなので、差は控除450万×15%＋子女税額控除25万
  assert.ok(Math.abs(single.incomeTax - family.incomeTax - (4_500_000 * 0.15 + 250_000)) < 1);
  assert.ok(Math.abs(single.localIncomeTax - family.localIncomeTax - (4_500_000 * 0.15 + 250_000) * 0.1) < 1);

  const base: ScenarioInput = { id: "seoul", cityId: "seoul", annualSalary: 55_000_000, salaryCurrency: "KRW", age: 35, householdType: "couple", children: 2, housing: "twobed", lifestyle: "balanced" };
  const withFamily = calculateScenario({ ...base, spouseAnnualSalary: 0, childrenAges: [5, 12] });
  const withoutFamily = calculateScenario(base);
  assert.ok(withFamily.netAnnual! > withoutFamily.netAnnual!);
});
