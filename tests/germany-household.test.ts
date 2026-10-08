import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateGermanyPayroll, germanIncomeTax2026, germanyHouseholdTakeHome2026 } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("German joint assessment taxes half the combined taxable income and doubles it (EStG §32a Abs.5)", () => {
  // 同じ給与の夫婦は、合算課税でも個別課税と税額が変わらない
  const equal = germanyHouseholdTakeHome2026(60_000, 60_000, "couple");
  assert.ok(Math.abs(equal.jointNetAnnual - equal.separateNetAnnual) < 1);
  // 片働きの夫婦は合算課税のほうが手取りが多い。個別課税の合計は本人の単身の手取りと一致する（配偶者の給与0）
  const single = calculateGermanyPayroll(80_000, "couple");
  const oneIncome = germanyHouseholdTakeHome2026(80_000, 0, "couple");
  const singleNet = 80_000 - single.incomeTax - single.solidarity - single.pension - single.unemployment - single.health - single.care;
  assert.ok(Math.abs(oneIncome.separateNetAnnual - singleNet) < 1);
  assert.ok(oneIncome.jointNetAnnual > oneIncome.separateNetAnnual + 5_000);
  // 合算課税の所得税は課税所得の半分に対する税額の2倍（配偶者は特別支出控除€36だけ）
  const taxable = 80_000 - 1_230 - 36 - (single.pension + single.health * 0.96 + single.care);
  const jointIncomeTax = 2 * germanIncomeTax2026((taxable - 36) / 2);
  assert.ok(Math.abs(80_000 - single.pension - single.unemployment - single.health - single.care - jointIncomeTax - oneIncome.jointNetAnnual) < 1);
});

test("Berlin results show the household take-home only for couples who enter a spouse salary, without changing the score inputs", () => {
  const base: ScenarioInput = { id: "berlin", cityId: "berlin", annualSalary: 80_000, salaryCurrency: "EUR", age: 35, householdType: "couple", children: 0, housing: "twobed", lifestyle: "balanced" };
  const withSpouse = calculateScenario({ ...base, spouseAnnualSalary: 0 });
  assert.equal(withSpouse.householdTakeHome?.basis, "germanySplitting");
  assert.equal(withSpouse.netAnnual, calculateScenario(base).netAnnual);
  assert.equal(calculateScenario(base).householdTakeHome, null);
  assert.equal(calculateScenario({ ...base, cityId: "london", id: "london", salaryCurrency: "GBP", spouseAnnualSalary: 0 }).householdTakeHome, null);
});
