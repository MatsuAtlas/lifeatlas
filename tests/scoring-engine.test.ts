import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { DEFAULT_PRIORITIES, LIFE_ATLAS_SCORE_WEIGHTS, scoreScenarios } from "../lib/scoring/life-atlas-score.ts";
import type { CityId, CurrencyCode } from "../types/city.ts";
import type { ScenarioInput, UserPriorities } from "../types/scenario.ts";

function offer(id: string, cityId: CityId, annualSalary: number, salaryCurrency: CurrencyCode, overrides: Partial<ScenarioInput> = {}) {
  return calculateScenario({
    id,
    cityId,
    annualSalary,
    salaryCurrency,
    age: 29,
    householdType: "single",
    children: 0,
    housing: "onebed",
    lifestyle: "balanced",
    ...overrides,
  });
}

const scenarios = () => [
  offer("tokyo-offer", "tokyo", 7_000_000, "JPY"),
  offer("vancouver-offer", "vancouver", 90_000, "CAD"),
  offer("berlin-offer", "berlin", 70_000, "EUR"),
];

test("ranks 2-5 scenarios with transparent 45/20/25/10 contributions", () => {
  const ranked = scoreScenarios(scenarios(), DEFAULT_PRIORITIES);

  assert.deepEqual(ranked.map((result) => result.rank), [1, 2, 3]);
  for (const result of ranked.filter((item) => item.eligible)) {
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(Math.abs(result.contributions.financial - result.financialScore * LIFE_ATLAS_SCORE_WEIGHTS.financial) <= 0.2);
    assert.ok(Math.abs(result.contributions.lifestyle - result.lifestyleScore * LIFE_ATLAS_SCORE_WEIGHTS.lifestyle) <= 0.2);
    assert.ok(Math.abs(result.contributions.preference - result.preferenceScore * LIFE_ATLAS_SCORE_WEIGHTS.preference) <= 0.2);
    assert.ok(Math.abs(result.contributions.confidence - result.confidenceScore * LIFE_ATLAS_SCORE_WEIGHTS.confidence) <= 0.2);
    assert.equal(result.strongestFactors.length, 3);
    assert.equal(result.weakestFactors.length, 3);
  }
});

test("never lets an unsupported financial scenario outrank eligible scenarios", () => {
  const ranked = scoreScenarios(scenarios(), { ...DEFAULT_PRIORITIES, qualityOfLife: 5, career: 5 });
  const berlin = ranked.find((result) => result.scenarioId === "berlin-offer");

  assert.equal(berlin?.eligible, false);
  assert.equal(berlin?.rank, 3);
  assert.ok((berlin?.score ?? 100) <= 35);
  assert.ok(berlin?.riskFlags.includes("calculation-unavailable"));
  assert.ok(berlin?.riskFlags.includes("low-data-confidence"));
});

test("produces stable rankings regardless of input order", () => {
  const forward = scoreScenarios(scenarios(), DEFAULT_PRIORITIES).map((result) => result.scenarioId);
  const reversed = scoreScenarios(scenarios().reverse(), DEFAULT_PRIORITIES).map((result) => result.scenarioId);
  assert.deepEqual(reversed, forward);
});

test("reports weighted priorities that lack source data instead of inventing a score", () => {
  const priorities: UserPriorities = { ...DEFAULT_PRIORITIES, climate: 5 };
  const ranked = scoreScenarios(scenarios(), priorities);
  for (const result of ranked) assert.ok(result.omittedPriorities.includes("climate"));
});

test("surfaces deterministic financial risk flags", () => {
  const deficit = offer("deficit", "tokyo", 7_000_000, "JPY", { customRent: 300_000, customMonthlySpending: 500_000 });
  const ranked = scoreScenarios([deficit, offer("baseline", "tokyo", 7_000_000, "JPY")], DEFAULT_PRIORITIES);
  const scoredDeficit = ranked.find((result) => result.scenarioId === "deficit");
  assert.ok(scoredDeficit?.riskFlags.includes("negative-savings"));
  assert.ok(scoredDeficit?.riskFlags.includes("high-housing-burden"));
  assert.ok(scoredDeficit?.riskFlags.includes("fire-target-unreachable"));
});

test("rejects invalid comparison sizes, duplicate scenarios and invalid priorities", () => {
  const [tokyo, vancouver] = scenarios();
  assert.throws(() => scoreScenarios([tokyo], DEFAULT_PRIORITIES), /between 2 and 5/);
  assert.throws(() => scoreScenarios([tokyo, { ...vancouver, scenarioId: tokyo.scenarioId }], DEFAULT_PRIORITIES), /unique/);
  assert.throws(() => scoreScenarios([tokyo, vancouver], { ...DEFAULT_PRIORITIES, savings: 6 }), /between 0 and 5/);
});
