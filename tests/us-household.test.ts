import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { usHouseholdTakeHome2026 } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("US married filing jointly uses the 2026 IRS joint brackets and supported state rules", () => {
  // テキサス（州所得税なし）：片働き$150,000の連邦税＝($150,000−$32,200)に夫婦の区切りを適用
  const houston = usHouseholdTakeHome2026(cities.houston, 150_000, 0)!;
  const federal = 24_800 * 0.1 + (100_800 - 24_800) * 0.12 + (150_000 - 32_200 - 100_800) * 0.22;
  const insurance = 150_000 * 0.062 + 150_000 * 0.0145 + cities.houston.insurance.healthInsuranceFamilyMonthly * 12;
  assert.ok(Math.abs(houston.jointNetAnnual - (150_000 - federal - insurance)) < 1);
  assert.ok(houston.jointNetAnnual > houston.separateNetAnnual);
  // イリノイ：控除$2,925×2人（連邦AGI$500,000超はなし）、4.95%
  const chicago = usHouseholdTakeHome2026(cities.chicago, 100_000, 50_000)!;
  const chicagoNoState = usHouseholdTakeHome2026(cities.houston, 100_000, 50_000)!;
  assert.ok(Math.abs(chicagoNoState.jointNetAnnual - chicago.jointNetAnnual - (150_000 - 5_850) * 0.0495) < 1);
  // マサチューセッツ：夫婦の控除$8,800、5%
  const boston = usHouseholdTakeHome2026(cities.boston, 100_000, 50_000)!;
  assert.ok(Math.abs(chicagoNoState.jointNetAnnual - boston.jointNetAnnual - (150_000 - 8_800) * 0.05) < 1);
  // 夫婦の扱いを確認できていない州は出さない
  assert.equal(usHouseholdTakeHome2026(cities.newYork, 100_000, 0), null);
  assert.equal(usHouseholdTakeHome2026(cities.losAngeles, 100_000, 0), null);
});

test("Houston results show the joint household take-home without changing your own take-home", () => {
  const base: ScenarioInput = { id: "houston", cityId: "houston", annualSalary: 150_000, salaryCurrency: "USD", age: 35, householdType: "couple", children: 0, housing: "twobed", lifestyle: "balanced" };
  const withSpouse = calculateScenario({ ...base, spouseAnnualSalary: 0 });
  assert.equal(withSpouse.householdTakeHome?.basis, "usMarriedFilingJointly");
  assert.equal(withSpouse.netAnnual, calculateScenario(base).netAnnual);
  assert.equal(calculateScenario({ ...base, id: "newYork", cityId: "newYork", spouseAnnualSalary: 0 }).householdTakeHome, null);
});
