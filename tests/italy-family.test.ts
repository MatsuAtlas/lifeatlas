import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateItalyPayroll, italySpouseCredit } from "../lib/calculations/legacy-engine.ts";

test("Italian spouse credit follows table 1 of the 730/2026 instructions", () => {
  assert.equal(italySpouseCredit(0), 800);
  assert.ok(Math.abs(italySpouseCredit(15_000) - 690) < 1e-9);
  assert.equal(italySpouseCredit(29_100), 700);
  assert.equal(italySpouseCredit(34_800), 720);
  assert.equal(italySpouseCredit(40_000), 690);
  assert.equal(italySpouseCredit(60_000), 345);
  assert.equal(italySpouseCredit(80_001), 0);
  // 配偶者の所得が€2,840.51以下の場合だけ。国の税額が控除の分だけ下がる
  const base = calculateItalyPayroll(50_000, "lazio");
  const withSpouse = calculateItalyPayroll(50_000, "lazio", 0);
  assert.ok(Math.abs(base.nationalTax - withSpouse.nationalTax - italySpouseCredit(base.reddito)) < 1e-6);
  assert.equal(calculateItalyPayroll(50_000, "lazio", 3_000).nationalTax, base.nationalTax);
  const tax = (household: "single" | "couple", spouseSalary?: number) => calculateCity(cities.rome, 50_000, household, "onebed", "balanced", "under40", { family: { spouseSalary } }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(tax("couple", 0) < tax("couple"));
});
