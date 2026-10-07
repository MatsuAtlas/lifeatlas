import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateThailandPayroll, thailandFamilyAllowance } from "../lib/calculations/legacy-engine.ts";

test("Thailand family allowances follow the Revenue Department amounts", () => {
  // 所得のない配偶者฿60,000、子ども฿30,000、2018年以降生まれ（2026年12月31日に8歳以下）の第2子以降฿60,000
  assert.equal(thailandFamilyAllowance({ spouseSalary: 0 }), 60_000);
  assert.equal(thailandFamilyAllowance({ spouseSalary: 1 }), 0);
  assert.equal(thailandFamilyAllowance({ childrenAges: [10, 8] }), 30_000 + 60_000);
  assert.equal(thailandFamilyAllowance({ childrenAges: [9, 10] }), 60_000);
  // 第1子は2018年以降生まれでも฿30,000
  assert.equal(thailandFamilyAllowance({ childrenAges: [3] }), 30_000);
  // 20歳以上の子は数えないが、生まれ順には含める
  assert.equal(thailandFamilyAllowance({ childrenAges: [22, 5] }), 60_000);

  // 年収฿800,000の課税所得は฿629,500（−給与所得控除฿100,000−基礎控除฿60,000−社会保険料฿10,500）。
  // 家族の控除฿150,000で฿479,500になり、15%区間の฿129,500と10%区間の฿20,500の分だけ税額が下がる
  const saving = 129_500 * 0.15 + 20_500 * 0.1;
  assert.ok(Math.abs(calculateThailandPayroll(800_000).incomeTax - calculateThailandPayroll(800_000, { spouseSalary: 0, childrenAges: [10, 8] }).incomeTax - saving) < 0.01);
  const tax = (family: { spouseSalary?: number; childrenAges?: number[] }) => calculateCity(cities.bangkok, 800_000, "couple", "onebed", "balanced", "under40", { family }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(Math.abs(tax({}) - tax({ spouseSalary: 0, childrenAges: [10, 8] }) - saving) < 0.01);
});
