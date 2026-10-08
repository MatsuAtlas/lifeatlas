import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateBrazilPayroll, calculateCity } from "../lib/calculations/legacy-engine.ts";

test("Brazilian dependant deductions add to INSS and compete with the simplified discount", () => {
  // 月R$20,000（27.5%の区分、減額なし）：子ども2人で課税基礎がR$379.18下がる
  const base = calculateBrazilPayroll(240_000).incomeTax;
  close(base - calculateBrazilPayroll(240_000, 2).incomeTax, Math.round(379.18 * 0.275 * 100) / 100 * 12, 0.13);
  // 月R$3,000：INSS R$253.41＋扶養1人R$189.59＝R$443 は簡易控除R$607.20より少ないので変わらない
  assert.equal(calculateBrazilPayroll(36_000, 1).incomeTax, calculateBrazilPayroll(36_000).incomeTax);
});

test("only single parents or couples with a spouse salary of 0 claim children aged 21 or under", () => {
  const tax = (household: "singleParent" | "family", ages: number[], spouseSalary?: number) => calculateCity(cities.saoPaulo, 240_000, household, "onebed", "balanced", "under40", { family: { childrenAges: ages, spouseSalary } }).taxBreakdown!.incomeTaxMonthly * 12;
  assert.ok(tax("singleParent", [10]) < tax("singleParent", []));
  assert.equal(tax("singleParent", [22]), tax("singleParent", []));
  assert.ok(tax("family", [10], 0) < tax("family", [], 0));
  assert.equal(tax("family", [10], 50_000), tax("family", [], 50_000));
});

function close(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}
