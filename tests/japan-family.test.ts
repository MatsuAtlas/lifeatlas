import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateCity, japanFamilyDeductions } from "../lib/calculations/legacy-engine.ts";
import { simulateWhatIf } from "../lib/calculations/what-if.ts";
import { isScenarioInput } from "../lib/comparison-history.ts";
import { DEFAULT_PRIORITIES } from "../lib/scoring/life-atlas-score.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("Japanese family deductions follow the 2026 NTA tables and the Yokohama resident-tax amounts", () => {
  // 配偶者の給与0（所得0）：配偶者控除 所得税38万・住民税33万。子ども10歳（なし）・17歳（一般）・20歳（特定）
  assert.deepEqual(japanFamilyDeductions(4_360_000, { spouseSalary: 0, childrenAges: [10, 17, 20] }), { incomeTax: 380_000 + 380_000 + 630_000, residentTax: 330_000 + 330_000 + 450_000 });
  // 配偶者の給与136万円 → 所得62万円（給与所得控除74万円）＝配偶者控除の上限
  assert.deepEqual(japanFamilyDeductions(4_000_000, { spouseSalary: 1_360_000 }), { incomeTax: 380_000, residentTax: 330_000 });
  // 給与160万円 → 所得86万円：配偶者特別控除（62万超95万以下）38万・住民税33万
  assert.deepEqual(japanFamilyDeductions(4_000_000, { spouseSalary: 1_600_000 }), { incomeTax: 380_000, residentTax: 330_000 });
  // 給与200万円 → 所得126万円（125万超130万以下）：所得税6万・住民税6万
  assert.deepEqual(japanFamilyDeductions(4_000_000, { spouseSalary: 2_000_000 }), { incomeTax: 60_000, residentTax: 60_000 });
  // 本人の合計所得900万超950万以下は2段目（26万・22万）、1,000万超は配偶者の控除なし
  assert.deepEqual(japanFamilyDeductions(9_200_000, { spouseSalary: 0 }), { incomeTax: 260_000, residentTax: 220_000 });
  assert.deepEqual(japanFamilyDeductions(10_000_001, { spouseSalary: 0 }), { incomeTax: 0, residentTax: 0 });
  // 配偶者の所得133万円超（給与215万円→所得141万円）は対象外
  assert.deepEqual(japanFamilyDeductions(4_000_000, { spouseSalary: 2_150_000 }), { incomeTax: 0, residentTax: 0 });
  // ひとり親控除：所得税35万・住民税30万（本人の合計所得500万円以下）
  assert.deepEqual(japanFamilyDeductions(5_000_000, { singleParent: true }), { incomeTax: 350_000, residentTax: 300_000 });
  assert.deepEqual(japanFamilyDeductions(5_000_001, { singleParent: true }), { incomeTax: 0, residentTax: 0 });
});

test("family deductions lower Tokyo tax only when entered, and resident tax falls by 10% of the deduction", () => {
  const tokyo = cities.tokyo;
  const base = calculateCity(tokyo, 6_000_000, "family", "onebed", "balanced", "under40");
  const withFamily = calculateCity(tokyo, 6_000_000, "family", "onebed", "balanced", "under40", { family: { spouseSalary: 0, childrenAges: [10, 17] } });
  // 住民税：(33万＋33万)×10％＝66,000円
  assert.ok(Math.abs((base.taxBreakdown!.residentTaxMonthly - withFamily.taxBreakdown!.residentTaxMonthly) * 12 - 66_000) < 0.01);
  assert.ok(withFamily.taxBreakdown!.incomeTaxMonthly < base.taxBreakdown!.incomeTaxMonthly);
  // ひとり親世帯は世帯区分から自動で反映（ホームとOffer Analyzerで同じ）
  const single = calculateCity(tokyo, 4_000_000, "single", "onebed", "balanced", "under40");
  const singleParent = calculateCity(tokyo, 4_000_000, "singleParent", "onebed", "balanced", "under40");
  assert.ok(Math.abs((single.taxBreakdown!.residentTaxMonthly - singleParent.taxBreakdown!.residentTaxMonthly) * 12 - 30_000) < 0.01);
  // 日本以外の都市は家族の入力を使わない
  const london = calculateCity(cities.london, 60_000, "family", "onebed", "balanced", "under40");
  assert.equal(calculateCity(cities.london, 60_000, "family", "onebed", "balanced", "under40", { family: { spouseSalary: 0, childrenAges: [17] } }).taxMonthly, london.taxMonthly);
});

test("scenario inputs validate spouse salary and children's ages, and What-If trims ages when children fall", () => {
  const input: ScenarioInput = { id: "a", cityId: "tokyo", annualSalary: 6_000_000, salaryCurrency: "JPY", age: 40, householdType: "couple", children: 2, housing: "twobed", lifestyle: "balanced", spouseAnnualSalary: 0, childrenAges: [10, 17] };
  assert.equal(isScenarioInput(input), true);
  assert.equal(isScenarioInput({ ...input, childrenAges: [10, 17, 20] }), false);
  assert.equal(isScenarioInput({ ...input, childrenAges: [10.5] }), false);
  assert.equal(isScenarioInput({ ...input, spouseAnnualSalary: -1 }), false);
  // 単身なら配偶者の給与は使わない
  assert.equal(calculateScenario({ ...input, householdType: "single", spouseAnnualSalary: 0 }).taxAnnual, calculateScenario({ ...input, householdType: "single", spouseAnnualSalary: undefined }).taxAnnual);
  const other: ScenarioInput = { ...input, id: "b", cityId: "osaka" };
  const simulation = simulateWhatIf({ scenarios: [input, other], changes: [{ type: "children", scenarioId: "a", value: 1 }], priorities: DEFAULT_PRIORITIES });
  assert.deepEqual(simulation.after.inputs.find((item) => item.id === "a")!.childrenAges, [10]);
});
