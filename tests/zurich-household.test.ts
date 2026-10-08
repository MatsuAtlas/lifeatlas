import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateZurichPayroll, swissFederalMarriedIncomeTax2026, zurichHouseholdTakeHome2026, zurichMarriedSimpleStateTax2026 } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("Swiss federal married tariff matches the ESTV 2026 table", () => {
  // ESTV Form. 58 c 2026 の夫婦・ひとり親の列
  assert.equal(swissFederalMarriedIncomeTax2026(33_000), 33);
  assert.equal(swissFederalMarriedIncomeTax2026(32_000), 0);
  assert.equal(swissFederalMarriedIncomeTax2026(82_100), 1_049);
  assert.equal(swissFederalMarriedIncomeTax2026(160_000), 6_680);
  assert.equal(swissFederalMarriedIncomeTax2026(941_300), 108_249);
  assert.equal(swissFederalMarriedIncomeTax2026(950_000), 109_250);
});

test("Zurich married tariff follows StG §35 Abs.2", () => {
  // CHF 100,000：14,100まで0%、以降2%〜8%の区間
  const expected = 6_400 * 0.02 + 8_100 * 0.03 + 9_800 * 0.04 + 11_200 * 0.05 + 14_500 * 0.06 + 32_200 * 0.07 + 3_700 * 0.08;
  assert.ok(Math.abs(zurichMarriedSimpleStateTax2026(100_000) - expected) < 0.01);
});

test("Zurich one-income couple pays less under joint assessment and the household figure leaves your own take-home unchanged", () => {
  const payroll = calculateZurichPayroll(150_000);
  const household = zurichHouseholdTakeHome2026(150_000, 0);
  const professionalFlat = Math.min(4_000, Math.max(2_000, payroll.netWage * 0.03));
  const federalTaxable = payroll.netWage - 800 - 3_200 - professionalFlat - 3_700 - 2_800;
  const cantonalTaxable = payroll.netWage - 1_400 - 3_200 - professionalFlat - 5_800;
  const tax = swissFederalMarriedIncomeTax2026(federalTaxable) + zurichMarriedSimpleStateTax2026(cantonalTaxable) * (0.98 + 1.19) + 48;
  const contributions = payroll.ahv + payroll.alv + payroll.nbu + payroll.bvg;
  assert.ok(Math.abs(household.jointNetAnnual - (150_000 - contributions - tax)) < 0.01);
  assert.ok(household.jointNetAnnual > household.separateNetAnnual);
  // 子ども2人：連邦は子どもの控除と税額からCHF 263ずつ、州は子どもの控除と保険料控除の加算
  assert.ok(zurichHouseholdTakeHome2026(150_000, 0, [5, 12]).jointNetAnnual > household.jointNetAnnual);

  const base: ScenarioInput = { id: "zurich", cityId: "zurich", annualSalary: 150_000, salaryCurrency: "CHF", age: 35, householdType: "couple", children: 0, housing: "twobed", lifestyle: "balanced" };
  const withSpouse = calculateScenario({ ...base, spouseAnnualSalary: 0 });
  assert.equal(withSpouse.householdTakeHome?.basis, "zurichJointAssessment");
  assert.equal(withSpouse.netAnnual, calculateScenario(base).netAnnual);
});
