import { cities } from "../../data/cities.ts";
import { calculateScenario } from "../calculations/calculate-scenario.ts";
import { scoreScenarios } from "../scoring/life-atlas-score.ts";
import type { CityId } from "../../types/city";
import type { ScenarioInput } from "../../types/scenario";

export function defaultCityScenario(cityId: CityId, id = `seo-${cityId}`): ScenarioInput {
  const city = cities[cityId];
  return {
    id,
    cityId,
    annualSalary: city.averageAnnualIncome,
    salaryCurrency: city.currency,
    age: 30,
    householdType: "single",
    children: 0,
    housing: "onebed",
    lifestyle: "balanced",
    retirementAge: 65,
    annualReturnRate: 0,
  };
}

export function calculateCityBaseline(cityId: CityId) {
  return calculateScenario(defaultCityScenario(cityId));
}

export function calculateSeoComparison(cityA: CityId, cityB: CityId) {
  const inputs = [defaultCityScenario(cityA, "seo-a"), defaultCityScenario(cityB, "seo-b")];
  const results = inputs.map((input) => calculateScenario(input));
  const scores = scoreScenarios(results);
  return { inputs, results, scores };
}
