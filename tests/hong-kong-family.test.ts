import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateHongKongSalariesTax } from "../lib/calculations/legacy-engine.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("Hong Kong uses the HK$290,000 married person's allowance only when the spouse has no income", () => {
  // 2026/27：基礎控除145,000、既婚者控除290,000（税務局の予算案ページ）。差の145,000は最高税率17%の区間にかかる
  const base = calculateHongKongSalariesTax(600_000, "couple");
  const married = calculateHongKongSalariesTax(600_000, "couple", 0);
  assert.ok(Math.abs(base.salariesTax - married.salariesTax - 145_000 * 0.17) < 0.01);
  // 配偶者に所得がある・単身なら既婚者控除はない
  assert.equal(calculateHongKongSalariesTax(600_000, "couple", 100_000).salariesTax, base.salariesTax);
  assert.equal(calculateHongKongSalariesTax(600_000, "single", 0).salariesTax, calculateHongKongSalariesTax(600_000, "single").salariesTax);

  const input: ScenarioInput = { id: "hongKong", cityId: "hongKong", annualSalary: 600_000, salaryCurrency: "HKD", age: 35, householdType: "couple", children: 0, housing: "twobed", lifestyle: "balanced" };
  assert.ok(calculateScenario({ ...input, spouseAnnualSalary: 0 }).netAnnual! > calculateScenario(input).netAnnual!);
});
