import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder, RENT_INCLUDES_UTILITIES } from "../data/cities.ts";
import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { calculateCity, householdMultipliers, lifestyleMultipliers } from "../lib/calculations/legacy-engine.ts";
import { simulateWhatIf } from "../lib/calculations/what-if.ts";
import { isScenarioInput } from "../lib/comparison-history.ts";
import type { CityId } from "../types/city.ts";
import type { ScenarioInput } from "../types/scenario.ts";

function assertClose(actual: number | null, expected: number, tolerance = 1e-6) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

const newYork: ScenarioInput = { id: "ny", cityId: "newYork", annualSalary: 140_000, salaryCurrency: "USD", age: 35, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" };

// 修正前の計算（光熱費を別に足す）は、同じ家賃を手入力して「別」と指定した場合と同じです。
const separateUtilities = (input: ScenarioInput) => {
  const base = calculateScenario(input);
  return calculateScenario({ ...input, customRent: base.rentMonthly, customRentIncludesUtilities: false });
};

test("the utilities-in-rent flag is explicit data and matches the 13 HUD Fair Market Rent cities", () => {
  assert.equal(RENT_INCLUDES_UTILITIES.length, 13);
  for (const cityId of cityOrder) {
    const city = cities[cityId];
    // 出典は計算条件の判定に使わず、データの整合だけを確認します。
    const usesHudRent = city.dataSources.some((source) => source.source.includes("Fair Market Rents"));
    assert.equal(city.rentIncludesUtilities, usesHudRent, cityId);
    // 参考値の光熱費は消さずに保持します。
    assert.ok(city.costs.utilities > 0, cityId);
  }
});

test("New York single, balanced, one bedroom spends $180 less and keeps $180 more a month", () => {
  const after = calculateScenario(newYork);
  const before = separateUtilities(newYork);
  assert.equal(cities.newYork.costs.utilities, 180);
  assertClose(before.totalLivingCostMonthly - after.totalLivingCostMonthly, 180);
  assertClose((after.monthlySurplus ?? 0) - (before.monthlySurplus ?? 0), 180);
  assert.equal(after.rentMonthly, before.rentMonthly);
  assert.equal(after.netMonthly, before.netMonthly);
  assert.equal(after.costBreakdownMonthly.utilitiesBasis, "includedInRent");
  assert.equal(after.costBreakdownMonthly.utilities, 0);
  // インターネットは引き続き別に計上します。
  assertClose(after.costBreakdownMonthly.internet, cities.newYork.costs.internet);
});

test("a New York couple spends $279 less a month", () => {
  const couple = { ...newYork, householdType: "couple" as const };
  assertClose(separateUtilities(couple).totalLivingCostMonthly - calculateScenario(couple).totalLivingCostMonthly, 279);
});

test("every HUD city drops its own utilities value, scaled by household and lifestyle", () => {
  const households = [
    { householdType: "single" as const, children: 0, model: "single" as const },
    { householdType: "couple" as const, children: 0, model: "couple" as const },
    { householdType: "couple" as const, children: 2, model: "family" as const },
  ];
  for (const cityId of RENT_INCLUDES_UTILITIES) {
    const city = cities[cityId];
    for (const household of households) {
      const input: ScenarioInput = { ...newYork, id: cityId, cityId, annualSalary: city.averageAnnualIncome, householdType: household.householdType, children: household.children, lifestyle: "comfortable" };
      const expected = city.costs.utilities * householdMultipliers[household.model] * lifestyleMultipliers.comfortable;
      assertClose(separateUtilities(input).totalLivingCostMonthly - calculateScenario(input).totalLivingCostMonthly, expected, 1e-6);
    }
  }
});

test("cities whose rent excludes utilities still count them separately", () => {
  for (const cityId of ["tokyo", "london", "vancouver", "sydney"] as CityId[]) {
    const city = cities[cityId];
    const result = calculateScenario({ ...newYork, id: cityId, cityId, annualSalary: city.averageAnnualIncome, salaryCurrency: city.currency });
    assert.equal(result.costBreakdownMonthly.utilitiesBasis, "separate");
    assertClose(result.costBreakdownMonthly.utilities, city.costs.utilities);
  }
});

test("a manual rent follows the stated utilities basis and marks unstated saved rents as unconfirmed", () => {
  const unstated = calculateScenario({ ...newYork, customRent: 3_000 });
  const included = calculateScenario({ ...newYork, customRent: 3_000, customRentIncludesUtilities: true });
  const separate = calculateScenario({ ...newYork, customRent: 3_000, customRentIncludesUtilities: false });
  assert.equal(unstated.costBreakdownMonthly.utilitiesBasis, "customRentUnconfirmed");
  assert.equal(included.costBreakdownMonthly.utilitiesBasis, "includedInRent");
  assert.equal(separate.costBreakdownMonthly.utilitiesBasis, "separate");
  // 未確認の過去データは従来どおり光熱費を別に計上し、解釈を黙って変えません。
  assert.equal(unstated.totalLivingCostMonthly, separate.totalLivingCostMonthly);
  assertClose(separate.totalLivingCostMonthly - included.totalLivingCostMonthly, 180);
  // 光熱費を別に払う都市でも、本人が「込み」と指定すれば足しません。
  const tokyoIncluded = calculateScenario({ ...newYork, id: "tokyo", cityId: "tokyo", annualSalary: 6_000_000, salaryCurrency: "JPY", customRent: 120_000, customRentIncludesUtilities: true });
  assert.equal(tokyoIncluded.costBreakdownMonthly.utilities, 0);
  assert.ok(isScenarioInput({ ...newYork, customRent: 3_000, customRentIncludesUtilities: true }));
  assert.ok(!isScenarioInput({ ...newYork, customRent: 3_000, customRentIncludesUtilities: "yes" }));
});

test("a custom monthly spending total is used as entered, without subtracting utilities", () => {
  const result = calculateScenario({ ...newYork, customMonthlySpending: 2_000 });
  assert.equal(result.costBreakdownMonthly.utilitiesBasis, "inCustomTotal");
  assert.equal(result.baselineSpendingMonthly, 2_000);
  assert.equal(result.totalLivingCostMonthly, result.rentMonthly + 2_000);
});

test("home and Offer Analyzer give the same spending for the same conditions", () => {
  for (const cityId of ["newYork", "chicago", "tokyo", "london"] as CityId[]) {
    const city = cities[cityId];
    const scenario = calculateScenario({ ...newYork, id: cityId, cityId, annualSalary: city.averageAnnualIncome, salaryCurrency: city.currency, householdType: "couple" });
    const home = calculateCity(city, city.averageAnnualIncome, "couple", "onebed", "balanced", "under40");
    assertClose(home.totalMonthlyCosts, scenario.totalLivingCostMonthly);
    const breakdown = home.livingCostBreakdown;
    assertClose(breakdown.food + breakdown.utilities + breakdown.internet + breakdown.transport + breakdown.medical + breakdown.leisure, home.livingCosts);
    assert.equal(home.utilitiesIncludedInRent, city.rentIncludesUtilities);
  }
});

test("What-If rent changes keep the original utilities basis", () => {
  const result = simulateWhatIf({ scenarios: [newYork, { ...newYork, id: "chicago", cityId: "chicago" }], changes: [{ type: "rentPercent", scenarioId: "ny", percent: 10 }, { type: "customRent", scenarioId: "chicago", value: 2_000 }] });
  const ny = result.after.results.find((item) => item.scenarioId === "ny");
  const chicago = result.after.results.find((item) => item.scenarioId === "chicago");
  assert.equal(ny?.costBreakdownMonthly.utilitiesBasis, "includedInRent");
  assert.equal(chicago?.costBreakdownMonthly.utilitiesBasis, "includedInRent");
  assertClose(ny?.rentMonthly ?? null, cities.newYork.costs.rent * 1.1, 1e-6);
});
