import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateColombiaPayroll, colombiaDependants } from "../lib/calculations/legacy-engine.ts";

const UVT = 52_374;
// 第241条の税率表（課税所得1,090〜1,700 UVTは19%）
const tariff19 = (taxable: number) => (taxable / UVT - 1_090) * 0.19 * UVT;

test("Colombian dependant deductions: 10% inside the 40% cap, 72 UVT outside, 25% exemption after deductions", () => {
  // 年$120,000,000：社会保険 年金5%＋医療4%で純所得$109,200,000
  close(calculateColombiaPayroll(120_000_000).incomeTax, tariff19(109_200_000 * 0.75));
  // 扶養1人：10%＝$12,000,000、72 UVT、25%は(109.2M−12M−72 UVT)×25%
  const additional = 72 * UVT;
  const exempt = (109_200_000 - 12_000_000 - additional) * 0.25;
  close(calculateColombiaPayroll(120_000_000, 1).incomeTax, tariff19(109_200_000 - 12_000_000 - exempt - additional));
  // 72 UVTは4人まで
  assert.equal(calculateColombiaPayroll(120_000_000, 5).incomeTax, calculateColombiaPayroll(120_000_000, 4).incomeTax);
});

test("dependants: children 18 or under when the user claims them, and a spouse under 260 UVT", () => {
  assert.equal(colombiaDependants([18, 19], true), 1);
  assert.equal(colombiaDependants([10], false), 0);
  assert.equal(colombiaDependants([], false, 260 * UVT - 1), 1);
  assert.equal(colombiaDependants([], false, 260 * UVT), 0);
  const tax = (household: "singleParent" | "family", ages: number[], spouseSalary?: number) => calculateCity(cities.bogota, 120_000_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages, spouseSalary } }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(tax("singleParent", [10]) < tax("singleParent", []));
  assert.ok(tax("family", [], 0) < tax("family", [], 50_000_000));
  assert.equal(tax("family", [10], 50_000_000), tax("family", [], 50_000_000));
});

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
}
