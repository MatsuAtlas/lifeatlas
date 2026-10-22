import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { findBreakEvenSalary } from "../lib/calculations/break-even.ts";
import { simulateWhatIf } from "../lib/calculations/what-if.ts";
import { isScenarioInput } from "../lib/comparison-history.ts";
import { scoreScenarios } from "../lib/scoring/life-atlas-score.ts";
import type { ScenarioInput } from "../types/scenario.ts";

function assertClose(actual: number | null | undefined, expected: number, tolerance = 1e-6) {
  assert.ok(actual !== null && actual !== undefined, `expected ${expected}, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

const nyCouple: ScenarioInput = { id: "ny", cityId: "newYork", annualSalary: 140_000, salaryCurrency: "USD", age: 35, householdType: "couple", children: 0, housing: "onebed", lifestyle: "balanced" };

test("a couple's surplus uses household take-home minus household spending, without adding own take-home twice", () => {
  for (const spouse of [0, 120_000]) {
    const result = calculateScenario({ ...nyCouple, spouseAnnualSalary: spouse });
    assert.equal(result.cashflow.basis, "household");
    assert.equal(result.cashflow.householdModel, "usMarriedFilingJointly");
    assert.equal(result.cashflow.unavailable, null);
    // 世帯の手取りは既存モデルの jointNetAnnual（本人分を含む）をそのまま使います。
    assert.equal(result.cashflow.netAnnual, result.householdTakeHome?.jointNetAnnual);
    assertClose(result.monthlySurplus, (result.householdTakeHome?.jointNetAnnual ?? 0) / 12 - result.totalLivingCostMonthly);
    assertClose(result.annualSavings, (result.monthlySurplus ?? 0) * 12);
    assertClose(result.savingsRate, ((result.annualSavings ?? 0) / (result.cashflow.netAnnual ?? 1)) * 100);
    assertClose(result.rentBurden, (result.rentMonthly / (result.cashflow.netMonthly ?? 1)) * 100);
    assert.equal(result.purchasingPowerIndex, Math.round(((result.cashflow.netMonthly ?? 0) / result.totalLivingCostMonthly) * 100));
    assert.notEqual(result.fire, null);
    // 本人の税・手取りの明細は本人分のまま（単身として課税）。
    assert.equal(result.netAnnual, calculateScenario(nyCouple).netAnnual);
  }
});

test("spouse income changes the household surplus: New York, own $140,000, spouse $0 vs $120,000", () => {
  const none = calculateScenario({ ...nyCouple, spouseAnnualSalary: 0 });
  const earning = calculateScenario({ ...nyCouple, spouseAnnualSalary: 120_000 });
  assertClose(none.monthlySurplus, 97_945.682 / 12 - 4_933.5, 1e-3);
  assertClose(earning.monthlySurplus, 169_992.572 / 12 - 4_933.5, 1e-3);
  assert.ok((earning.monthlySurplus ?? 0) > (none.monthlySurplus ?? 0));
});

test("own salary $0 with an earning spouse is still calculated from household take-home", () => {
  const result = calculateScenario({ ...nyCouple, annualSalary: 0, spouseAnnualSalary: 120_000 });
  assert.equal(result.cashflow.unavailable, null);
  assertClose(result.cashflow.netAnnual, result.householdTakeHome?.jointNetAnnual ?? Number.NaN);
  assert.ok((result.monthlySurplus ?? Number.NEGATIVE_INFINITY) > 0);
});

test("unknown spouse income or an unsupported household model leaves household figures unavailable, not filled in", () => {
  const unknown = calculateScenario(nyCouple);
  assert.equal(unknown.cashflow.unavailable, "spouseIncomeUnknown");
  assert.equal(unknown.unavailableReason, "household");
  for (const value of [unknown.cashflow.netAnnual, unknown.monthlySurplus, unknown.annualSavings, unknown.savingsRate, unknown.rentBurden, unknown.purchasingPowerIndex, unknown.projectedSavings5Years, unknown.fire]) assert.equal(value, null);
  // 本人の税・手取りは計算できているので明細は残します。
  assert.notEqual(unknown.netAnnual, null);

  const tokyo = calculateScenario({ ...nyCouple, id: "tokyo", cityId: "tokyo", annualSalary: 6_000_000, salaryCurrency: "JPY", spouseAnnualSalary: 0 });
  assert.equal(tokyo.cashflow.unavailable, "householdModelUnsupported");
  assert.equal(tokyo.monthlySurplus, null);
});

test("a single person's results are unchanged and use their own take-home", () => {
  const single = calculateScenario({ ...nyCouple, householdType: "single", spouseAnnualSalary: 120_000 });
  assert.equal(single.cashflow.basis, "individual");
  assert.equal(single.cashflow.netAnnual, single.netAnnual);
  assertClose(single.monthlySurplus, 3_616.07, 0.01);
  assert.equal(single.householdTakeHome, null);
});

test("household cash flow decides the score and rank; uncalculable households are not ranked alongside", () => {
  const ny = calculateScenario({ ...nyCouple, spouseAnnualSalary: 0 });
  const chicagoInput: ScenarioInput = { ...nyCouple, id: "chicago", cityId: "chicago" };
  const chicagoNone = calculateScenario({ ...chicagoInput, spouseAnnualSalary: 0 });
  const chicagoEarning = calculateScenario({ ...chicagoInput, spouseAnnualSalary: 200_000 });
  const before = scoreScenarios([ny, chicagoNone]).find((score) => score.scenarioId === "chicago");
  const after = scoreScenarios([ny, chicagoEarning]).find((score) => score.scenarioId === "chicago");
  assert.ok((after?.financialScore ?? 0) > (before?.financialScore ?? 0));
  assert.ok((after?.score ?? 0) > (before?.score ?? 0));

  const unknown = calculateScenario({ ...chicagoInput, id: "chicago-unknown" });
  const scores = scoreScenarios([unknown, ny]);
  const unknownScore = scores.find((score) => score.scenarioId === "chicago-unknown");
  assert.equal(unknownScore?.eligible, false);
  assert.ok((unknownScore?.score ?? 100) <= 35);
  assert.equal(unknownScore?.rank, 2);
  assert.ok(unknownScore?.riskFlags.includes("household-cashflow-unavailable"));
});

test("spouse income 0 and blank survive saving and restoring as different inputs", () => {
  const zero = { ...nyCouple, spouseAnnualSalary: 0 };
  const restoredZero = JSON.parse(JSON.stringify(zero));
  const restoredBlank = JSON.parse(JSON.stringify(nyCouple));
  assert.ok(isScenarioInput(restoredZero));
  assert.ok(isScenarioInput(restoredBlank));
  assert.equal(restoredZero.spouseAnnualSalary, 0);
  assert.equal(restoredBlank.spouseAnnualSalary, undefined);
  assert.deepEqual(calculateScenario(restoredZero), calculateScenario(zero));
  assert.equal(calculateScenario(restoredBlank).cashflow.unavailable, "spouseIncomeUnknown");
});

test("What-If and break-even use the same household basis", () => {
  const earning = { ...nyCouple, spouseAnnualSalary: 120_000 };
  const chicago = { ...earning, id: "chicago", cityId: "chicago" as const };
  const simulation = simulateWhatIf({ scenarios: [earning, chicago], changes: [{ type: "salaryPercent", scenarioId: "ny", percent: 10 }] });
  const after = simulation.after.results.find((item) => item.scenarioId === "ny");
  const direct = calculateScenario({ ...earning, annualSalary: 154_000 });
  assertClose(after?.monthlySurplus, direct.monthlySurplus ?? Number.NaN, 1e-6);
  assert.equal(after?.cashflow.basis, "household");
  // 単身→夫婦に変えると、配偶者の収入が未入力なので世帯の収支は計算しません。
  const toCouple = simulateWhatIf({ scenarios: [{ ...nyCouple, householdType: "single" }, chicago], changes: [{ type: "household", scenarioId: "ny", householdType: "couple" }] });
  assert.equal(toCouple.after.results.find((item) => item.scenarioId === "ny")?.cashflow.unavailable, "spouseIncomeUnknown");

  const breakEven = findBreakEvenSalary({ reference: earning, candidate: { ...chicago, spouseAnnualSalary: 0 }, metric: "disposableIncome" });
  assert.equal(breakEven.status, "matched");
  const achieved = calculateScenario({ ...chicago, spouseAnnualSalary: 0, annualSalary: breakEven.requiredAnnualSalary ?? 0 });
  assert.ok((achieved.cashflow.netAnnualJpy ?? 0) >= (calculateScenario(earning).cashflow.netAnnualJpy ?? Number.POSITIVE_INFINITY) - 1);
  const unavailable = findBreakEvenSalary({ reference: earning, candidate: { ...chicago, spouseAnnualSalary: undefined }, metric: "lifeAtlasScore" });
  assert.equal(unavailable.status, "calculation-unavailable");
});
