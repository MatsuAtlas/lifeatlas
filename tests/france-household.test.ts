import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateFrancePayroll, franceHouseholdTakeHome2026 } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const net = (gross: number) => {
  const payroll = calculateFrancePayroll(gross);
  return gross - payroll.pension - payroll.csgCrds - payroll.incomeTax;
};

test("French joint filing uses two parts for a couple, child half-parts capped at €1,807 and the couple décote", () => {
  // 同じ給与の夫婦（子どもなし）は、共同申告でも単身2人分と同じ税額
  const equal = franceHouseholdTakeHome2026(50_000, 50_000);
  assert.ok(Math.abs(equal.jointNetAnnual - equal.separateNetAnnual) < 1);
  assert.ok(Math.abs(equal.separateNetAnnual - 2 * net(50_000)) < 1);
  // 片働きは共同申告のほうが手取りが多い
  const oneIncome = franceHouseholdTakeHome2026(80_000, 0);
  assert.ok(oneIncome.jointNetAnnual > oneIncome.separateNetAnnual);
  // 子ども2人（1 part）の軽減は半part当たり€1,807が上限：高所得では上限どおり€3,614だけ増える
  const high = franceHouseholdTakeHome2026(200_000, 0);
  const highWithChildren = franceHouseholdTakeHome2026(200_000, 0, [5, 12]);
  assert.ok(Math.abs(highWithChildren.jointNetAnnual - high.jointNetAnnual - 2 * 1_807) < 1);
  // 18歳以上の子は数えない
  assert.equal(franceHouseholdTakeHome2026(200_000, 0, [18]).jointNetAnnual, high.jointNetAnnual);
});

test("Paris results show the joint-filing household take-home without changing your own take-home", () => {
  const base: ScenarioInput = { id: "paris", cityId: "paris", annualSalary: 60_000, salaryCurrency: "EUR", age: 35, householdType: "couple", children: 0, housing: "twobed", lifestyle: "balanced" };
  const withSpouse = calculateScenario({ ...base, spouseAnnualSalary: 0 });
  assert.equal(withSpouse.householdTakeHome?.basis, "franceQuotientFamilial");
  assert.equal(withSpouse.netAnnual, calculateScenario(base).netAnnual);
});
