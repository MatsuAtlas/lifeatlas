import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateIndonesiaPayroll, indonesiaFamilyPtkp } from "../lib/calculations/legacy-engine.ts";

test("Indonesian family PTKP: Rp4.5m for marriage and each dependant without income, up to three", () => {
  assert.equal(indonesiaFamilyPtkp([3, 5], [], true), 13_500_000);
  assert.equal(indonesiaFamilyPtkp([1, 2, 3, 4], [], false), 13_500_000);
  // 0歳（年内に生まれた子）と給与のある子は数えない
  assert.equal(indonesiaFamilyPtkp([0, 20], [0, 30_000_000], false), 0);
});

test("family PTKP lowers taxable income and is used only when the user's status is certain", () => {
  // 年Rp240,000,000（15%の区分）：PTKPがRp9,000,000増えると税はRp1,350,000減る
  assert.equal(calculateIndonesiaPayroll(240_000_000).incomeTax - calculateIndonesiaPayroll(240_000_000, 9_000_000).incomeTax, 1_350_000);
  const tax = (household: "singleParent" | "family", ages: number[], spouseSalary?: number) => calculateCity(cities.jakarta, 240_000_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages, spouseSalary } }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.equal(tax("singleParent", []) - tax("singleParent", [10]), 675_000);
  assert.equal(tax("family", [], 0) - tax("family", [10], 0), 675_000);
  assert.equal(tax("family", [10], 100_000_000), tax("family", [], 100_000_000));
});
