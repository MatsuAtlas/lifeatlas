import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateChinaPayroll, calculateCity, chinaChildDeduction } from "../lib/calculations/legacy-engine.ts";

test("China child special deductions apply ¥24,000 a year per child only when the taxpayer claims them in full", () => {
  // 国家税務総局公告2023年第14号：1人月¥2,000。12月31日に1〜17歳の子だけ数える
  assert.equal(chinaChildDeduction([0, 1, 17, 18], true), 2 * 24_000);
  assert.equal(chinaChildDeduction([5], false), 0);
  // 課税所得が20%の区間にある年収¥400,000：控除¥48,000の分だけ税額が20%下がる
  assert.ok(Math.abs(calculateChinaPayroll(400_000, "shanghai").incomeTax - calculateChinaPayroll(400_000, "shanghai", 48_000).incomeTax - 48_000 * 0.2) < 0.01);

  const tax = (household: "couple" | "singleParent", family: { spouseSalary?: number; childrenAges?: number[] }) => calculateCity(cities.shanghai, 400_000, household, "onebed", "balanced", "under40", { family }).taxBreakdown!.incomeTaxMonthly * 12;
  // 配偶者の給与が0の夫婦・一人親は本人が全額控除。配偶者に所得がある（または不明な）夫婦は配分を選べるため使わない
  assert.ok(Math.abs(tax("couple", { childrenAges: [5, 8] }) - tax("couple", { spouseSalary: 0, childrenAges: [5, 8] }) - 48_000 * 0.2) < 0.01);
  assert.equal(tax("couple", { spouseSalary: 100_000, childrenAges: [5, 8] }), tax("couple", { childrenAges: [5, 8] }));
  assert.ok(tax("singleParent", { childrenAges: [5] }) < tax("singleParent", {}));
});
