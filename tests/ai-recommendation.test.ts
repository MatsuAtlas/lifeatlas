import assert from "node:assert/strict";
import test from "node:test";

import { buildRecommendationInput, normalizeFollowUpQuestion, sha256Hex, stableRecommendationKey, validateAIRecommendation } from "../lib/ai/recommendation.ts";
import { DEFAULT_PRIORITIES } from "../lib/scoring/life-atlas-score.ts";
import type { AIRecommendation } from "../types/ai.ts";
import type { SavedAnalyzerInput } from "../types/comparison.ts";

const analysis: SavedAnalyzerInput = {
  kind: "offer-analyzer",
  version: 1,
  scenarios: [
    { id: "tokyo", cityId: "tokyo", annualSalary: 7_000_000, salaryCurrency: "JPY", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" },
    { id: "vancouver", cityId: "vancouver", annualSalary: 90_000, salaryCurrency: "CAD", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" },
  ],
  priorities: { ...DEFAULT_PRIORITIES },
  whatIf: { scenarioId: "vancouver", salaryPercent: 10, rentPercent: 5, exchangePercent: 2 },
  breakEven: { candidateScenarioId: "vancouver", metric: "lifeAtlasScore" },
};

function validRecommendation(input: ReturnType<typeof buildRecommendationInput>): AIRecommendation {
  return {
    winnerScenarioId: input.winnerScenarioId,
    executiveSummary: "計算済みの順位と不確実性をまとめた説明です。",
    reasons: [
      { title: "貯蓄", explanation: "計算済みの年間貯蓄が順位に影響しています。" },
      { title: "信頼度", explanation: "データ信頼度もスコアに反映されています。" },
    ],
    tradeoffs: input.scenarios.map((scenario) => ({ scenarioId: scenario.scenarioId, advantages: ["計算済みの強み"], disadvantages: ["確認が必要な点"] })),
    risks: ["個別控除は計算に含まれません。"],
    nextQuestions: ["家賃変化の影響を確認しますか？"],
  };
}

test("builds AI context by rerunning the deterministic engine", () => {
  const input = buildRecommendationInput(analysis, "ja", " 家賃の影響は？ ");

  assert.equal(input.version, 1);
  assert.equal(input.language, "ja");
  assert.equal(input.scenarios.length, 2);
  assert.equal(input.scenarios[0].rank, 1);
  assert.equal(input.scenarios[0].scenarioId, input.winnerScenarioId);
  assert.equal(input.whatIfApplied, true);
  assert.equal(input.followUpQuestion, " 家賃の影響は？ ");
  assert.ok(input.scenarios.every((scenario) => scenario.dataScope.updatedAt && scenario.dataScope.sourceLabel));
  assert.ok(input.scenarios.some((scenario) => scenario.financials.netAnnual !== null));
});

test("accepts only structured recommendations that preserve deterministic scenario identities", () => {
  const input = buildRecommendationInput(analysis, "en");
  const recommendation = validRecommendation(input);
  const scenarioIds = input.scenarios.map((scenario) => scenario.scenarioId);

  assert.equal(validateAIRecommendation(recommendation, input.winnerScenarioId, scenarioIds), true);
  assert.equal(validateAIRecommendation({ ...recommendation, winnerScenarioId: "invented" }, input.winnerScenarioId, scenarioIds), false);
  assert.equal(validateAIRecommendation({ ...recommendation, tradeoffs: recommendation.tradeoffs.slice(0, 1) }, input.winnerScenarioId, scenarioIds), false);
  assert.equal(validateAIRecommendation({ ...recommendation, tradeoffs: recommendation.tradeoffs.map((item) => ({ ...item, scenarioId: scenarioIds[0] })) }, input.winnerScenarioId, scenarioIds), false);
  assert.equal(validateAIRecommendation({ ...recommendation, reasons: [{ title: "Only one", explanation: "Insufficient" }] }, input.winnerScenarioId, scenarioIds), false);
});

test("normalizes bounded follow-up questions", () => {
  assert.equal(normalizeFollowUpQuestion("  家賃が上がる場合は？\n"), "家賃が上がる場合は？");
  assert.equal(normalizeFollowUpQuestion(""), undefined);
  assert.equal(normalizeFollowUpQuestion("x".repeat(401)), null);
  assert.equal(normalizeFollowUpQuestion(123), null);
});

test("creates stable provider-independent cache hashes", async () => {
  const input = buildRecommendationInput(analysis, "ja");
  const key = stableRecommendationKey(input, "provider/model", "v1");
  assert.equal(key, stableRecommendationKey(input, "provider/model", "v1"));
  assert.notEqual(key, stableRecommendationKey({ ...input, followUpQuestion: "別の質問" }, "provider/model", "v1"));
  assert.match(await sha256Hex(key), /^[0-9a-f]{64}$/);
});
