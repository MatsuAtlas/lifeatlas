import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateCity, calculateNetherlandsPayroll, expatTaxRegimeStatus, netherlandsExpatAllowance2026 } from "../lib/calculations/legacy-engine.ts";
import { isScenarioInput } from "../lib/comparison-history.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);

test("Dutch 30% ruling allowance follows the Belastingdienst 2026 examples, norm and cap", () => {
  // 「Inhoud van de expatregeling」の例：手当込み€70,000→€21,000、€50,000→€1,987（手当を除く給与は€48,013超が必要）
  close(netherlandsExpatAllowance2026(70_000), 21_000);
  close(netherlandsExpatAllowance2026(50_000), 1_987);
  assert.equal(netherlandsExpatAllowance2026(48_013), 0);
  assert.equal(netherlandsExpatAllowance2026(40_000), 0);
  // 上限€78,600は給与€262,000で到達
  close(netherlandsExpatAllowance2026(262_000), 78_600);
  close(netherlandsExpatAllowance2026(400_000), 78_600);
});

test("the 30% ruling only applies when requested, in Amsterdam, and above the salary norm", () => {
  const amsterdam = cities.amsterdam;
  const resident = calculateCity(amsterdam, 70_000, "single", "onebed", "balanced", "under40");
  const newcomer = calculateCity(amsterdam, 70_000, "single", "onebed", "balanced", "under40", { expatTaxRegime: true });
  assert.equal(resident.expatTaxRegime, "off");
  assert.equal(newcomer.expatTaxRegime, "applied");
  close(resident.taxMonthly!, calculateNetherlandsPayroll(70_000).box1AfterCredits / 12);
  // 非課税手当€21,000を除いた€49,000にBox 1を課税
  close(newcomer.taxMonthly!, calculateNetherlandsPayroll(49_000).box1AfterCredits / 12);
  assert.ok(newcomer.netMonthly! > resident.netMonthly!);

  const belowNorm = calculateCity(amsterdam, 45_000, "single", "onebed", "balanced", "under40", { expatTaxRegime: true });
  assert.equal(belowNorm.expatTaxRegime, "notEligible");
  assert.equal(belowNorm.taxMonthly, calculateCity(amsterdam, 45_000, "single", "onebed", "balanced", "under40").taxMonthly);

  // 特例を実装していない都市では通常税制のまま
  const tokyo = calculateCity(cities.tokyo, 6_000_000, "single", "onebed", "balanced", "under40", { expatTaxRegime: true });
  assert.equal(tokyo.expatTaxRegime, "notModeled");
  assert.equal(tokyo.taxMonthly, calculateCity(cities.tokyo, 6_000_000, "single", "onebed", "balanced", "under40").taxMonthly);
  assert.equal(expatTaxRegimeStatus(amsterdam, null, true), "notEligible");
});

test("scenario inputs carry the newcomer regime choice through validation and results", () => {
  const input: ScenarioInput = { id: "a", cityId: "amsterdam", annualSalary: 70_000, salaryCurrency: "EUR", age: 32, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced", expatTaxRegime: true };
  assert.equal(isScenarioInput(input), true);
  assert.equal(isScenarioInput({ ...input, expatTaxRegime: undefined }), true);
  assert.equal(isScenarioInput({ ...input, expatTaxRegime: "yes" }), false);
  const withRegime = calculateScenario(input);
  const withoutRegime = calculateScenario({ ...input, expatTaxRegime: undefined });
  assert.equal(withRegime.assumptions.expatTaxRegime, "applied");
  assert.equal(withoutRegime.assumptions.expatTaxRegime, "off");
  assert.ok(withRegime.netAnnual! > withoutRegime.netAnnual!);
});
