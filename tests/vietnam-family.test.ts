import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity, calculateVietnamPayroll } from "../lib/calculations/legacy-engine.ts";

test("Vietnam dependant deduction is ₫6.2 million a month per child when the taxpayer claims the children", () => {
  // 月収₫100,000,000：課税所得は約₫7,900万で30%区間（₫6,000万〜1億）。子ども2人の扶養控除₫12,400,000を引いても
  // 同じ区間にあるため、月の税額は30%分下がる（年12か月）
  const saving = 12_400_000 * 0.3 * 12;
  assert.ok(Math.abs(calculateVietnamPayroll(1_200_000_000).incomeTax - calculateVietnamPayroll(1_200_000_000, 2).incomeTax - saving) < 1);

  const tax = (household: "couple" | "singleParent", family: { spouseSalary?: number; childrenAges?: number[] }) => calculateCity(cities.hoChiMinh, 1_200_000_000, household, "onebed", "balanced", "under40", { family }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(Math.abs(tax("couple", {}) - tax("couple", { spouseSalary: 0, childrenAges: [5, 12] }) - saving) < 1);
  // 配偶者に所得がある夫婦、0歳・18歳以上の子は数えない
  assert.equal(tax("couple", { spouseSalary: 100_000_000, childrenAges: [5, 12] }), tax("couple", {}));
  assert.equal(tax("singleParent", { childrenAges: [0, 18] }), tax("singleParent", {}));
  assert.ok(tax("singleParent", { childrenAges: [17] }) < tax("singleParent", {}));
});
