import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateIrelandPayrollTax } from "../lib/calculations/legacy-engine.ts";

const incomeTax = (cityId: "london" | "edinburgh" | "dublin", gross: number, household: "single" | "couple" | "singleParent", family: { spouseSalary?: number; childrenAges?: number[] } = {}) =>
  calculateCity(cities[cityId], gross, household, "onebed", "balanced", "under40", { family }).taxBreakdown!.incomeTaxMonthly * 12;

test("UK Marriage Allowance takes up to £252 off a basic-rate taxpayer whose spouse earns below the personal allowance", () => {
  assert.ok(Math.abs(incomeTax("london", 40_000, "couple") - incomeTax("london", 40_000, "couple", { spouseSalary: 0 }) - 252) < 0.01);
  // 配偶者の収入が£12,570以上、本人が高税率（イングランド£50,270超）なら使えない
  assert.equal(incomeTax("london", 40_000, "couple", { spouseSalary: 12_570 }), incomeTax("london", 40_000, "couple"));
  assert.equal(incomeTax("london", 60_000, "couple", { spouseSalary: 0 }), incomeTax("london", 60_000, "couple"));
  // スコットランドは intermediate rate まで（£43,662）
  assert.ok(incomeTax("edinburgh", 43_000, "couple") - incomeTax("edinburgh", 43_000, "couple", { spouseSalary: 0 }) > 251);
  assert.equal(incomeTax("edinburgh", 45_000, "couple", { spouseSalary: 0 }), incomeTax("edinburgh", 45_000, "couple"));
});

test("Ireland applies the 2026 one-income married and single parent bands and credits", () => {
  // 片働き夫婦：標準税率帯€53,000、税額控除€6,000（既婚者€4,000＋給与所得者€2,000）
  assert.equal(calculateIrelandPayrollTax(80_000, "marriedOneIncome").incomeTax, 53_000 * 0.2 + 27_000 * 0.4 - 6_000);
  // 一人親：標準税率帯€48,000、税額控除€5,900（単身€2,000＋給与所得者€2,000＋SPCCC €1,900）
  assert.equal(calculateIrelandPayrollTax(80_000, "singleParent").incomeTax, 48_000 * 0.2 + 32_000 * 0.4 - 5_900);
  assert.equal(incomeTax("dublin", 80_000, "couple", { spouseSalary: 0 }), calculateIrelandPayrollTax(80_000, "marriedOneIncome").incomeTax);
  assert.equal(incomeTax("dublin", 80_000, "couple", { spouseSalary: 20_000 }), calculateIrelandPayrollTax(80_000).incomeTax);
  // 一人親は12月31日に18歳以下の子がいる場合だけ
  assert.equal(incomeTax("dublin", 80_000, "singleParent", { childrenAges: [18] }), calculateIrelandPayrollTax(80_000, "singleParent").incomeTax);
  assert.equal(incomeTax("dublin", 80_000, "singleParent", { childrenAges: [19] }), calculateIrelandPayrollTax(80_000).incomeTax);
  assert.equal(incomeTax("dublin", 80_000, "singleParent"), calculateIrelandPayrollTax(80_000).incomeTax);
});
