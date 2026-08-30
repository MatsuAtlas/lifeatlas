import { cities } from "../../data/cities.ts";
import { simulateWhatIf } from "../calculations/what-if.ts";
import type { AIRecommendation, RecommendationInput, RecommendationLanguage } from "../../types/ai";
import type { SavedAnalyzerInput } from "../../types/comparison";
import type { WhatIfChange } from "../../types/what-if";

const MAX_FOLLOW_UP_LENGTH = 400;
const MAX_TEXT_LENGTH = 1_200;
const MAX_SHORT_TEXT_LENGTH = 240;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, maxItems: number) {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= MAX_SHORT_TEXT_LENGTH);
}

export function normalizeFollowUpQuestion(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 && normalized.length <= MAX_FOLLOW_UP_LENGTH ? normalized : null;
}

export function buildRecommendationInput(
  analysis: SavedAnalyzerInput,
  language: RecommendationLanguage,
  followUpQuestion?: string,
): RecommendationInput {
  const target = analysis.scenarios.find((scenario) => scenario.id === analysis.whatIf.scenarioId) ?? analysis.scenarios[0];
  const targetCurrency = cities[target.cityId].currency;
  const changes: WhatIfChange[] = [];
  if (analysis.whatIf.salaryPercent !== 0) changes.push({ type: "salaryPercent", scenarioId: target.id, percent: analysis.whatIf.salaryPercent });
  if (analysis.whatIf.rentPercent !== 0) changes.push({ type: "rentPercent", scenarioId: target.id, percent: analysis.whatIf.rentPercent });
  if (analysis.whatIf.exchangePercent !== 0 && targetCurrency !== "JPY") changes.push({ type: "exchangeRatePercent", currency: targetCurrency, percent: analysis.whatIf.exchangePercent });

  const initial = simulateWhatIf({ scenarios: analysis.scenarios, changes, priorities: analysis.priorities });
  const winnerScenarioId = initial.after.scores[0].scenarioId;
  const requestedCandidate = analysis.breakEven.candidateScenarioId;
  const candidateScenarioId = requestedCandidate !== winnerScenarioId
    ? requestedCandidate
    : analysis.scenarios.find((scenario) => scenario.id !== winnerScenarioId)?.id;
  const simulation = simulateWhatIf({
    scenarios: analysis.scenarios,
    changes,
    priorities: analysis.priorities,
    breakEven: candidateScenarioId ? [{ referenceScenarioId: winnerScenarioId, candidateScenarioId, metric: analysis.breakEven.metric }] : [],
  });
  const resultById = new Map(simulation.after.results.map((result) => [result.scenarioId, result]));
  const inputById = new Map(simulation.after.inputs.map((input) => [input.id, input]));

  return {
    version: 1,
    language,
    userPriorities: { ...analysis.priorities },
    winnerScenarioId,
    scenarios: simulation.after.scores.map((score) => {
      const result = resultById.get(score.scenarioId);
      const input = inputById.get(score.scenarioId);
      if (!result || !input) throw new Error("AI_CONTEXT_SCENARIO_MISSING");
      const city = cities[result.cityId];
      return {
        scenarioId: score.scenarioId,
        cityId: result.cityId,
        cityName: language === "ja" ? city.name : city.englishName ?? city.name,
        country: language === "ja" ? city.country : city.englishCountry ?? city.country,
        salary: { annual: input.annualSalary + (input.bonus ?? 0), currency: input.salaryCurrency },
        household: { type: input.householdType, children: input.children, housing: input.housing, lifestyle: input.lifestyle },
        rank: score.rank,
        lifeAtlasScore: score.score,
        calculationStatus: result.calculationStatus,
        financials: {
          grossAnnual: result.grossAnnual,
          netAnnual: result.netAnnual,
          totalLivingCostMonthly: result.totalLivingCostMonthly,
          annualSavings: result.annualSavings,
          savingsRate: result.savingsRate,
          projectedSavings5Years: result.projectedSavings5Years,
          projectedSavings10Years: result.projectedSavings10Years,
          fireYearsToTarget: result.fire?.yearsToTarget ?? null,
          currency: result.currency,
        },
        dataConfidence: {
          level: result.dataConfidence.level,
          score: result.dataConfidence.score,
          reasons: result.dataConfidence.reasons,
        },
        omittedPriorities: score.omittedPriorities,
        riskFlags: score.riskFlags,
        dataScope: { updatedAt: city.updatedAt, sourceLabel: city.sourceLabel },
      };
    }),
    breakEvenResults: simulation.after.breakEven.map((item) => ({
      candidateScenarioId: item.candidateScenarioId,
      referenceScenarioId: item.referenceScenarioId,
      metric: item.metric,
      status: item.status,
      requiredAnnualSalary: item.requiredAnnualSalary,
      salaryCurrency: item.salaryCurrency,
    })),
    whatIfApplied: changes.length > 0,
    ...(followUpQuestion ? { followUpQuestion } : {}),
  };
}

export function validateAIRecommendation(
  value: unknown,
  winnerScenarioId: string,
  scenarioIdList: string[],
): value is AIRecommendation {
  if (!isObject(value) || value.winnerScenarioId !== winnerScenarioId) return false;
  if (typeof value.executiveSummary !== "string" || value.executiveSummary.trim().length === 0 || value.executiveSummary.length > MAX_TEXT_LENGTH) return false;
  if (!Array.isArray(value.reasons) || value.reasons.length < 2 || value.reasons.length > 5 || !value.reasons.every((reason) => isObject(reason)
    && typeof reason.title === "string" && reason.title.trim().length > 0 && reason.title.length <= MAX_SHORT_TEXT_LENGTH
    && typeof reason.explanation === "string" && reason.explanation.trim().length > 0 && reason.explanation.length <= MAX_TEXT_LENGTH)) return false;
  const scenarioIds = new Set(scenarioIdList);
  if (!Array.isArray(value.tradeoffs) || value.tradeoffs.length !== scenarioIds.size || !value.tradeoffs.every((tradeoff) => isObject(tradeoff)
    && typeof tradeoff.scenarioId === "string" && scenarioIds.has(tradeoff.scenarioId)
    && isStringArray(tradeoff.advantages, 5)
    && isStringArray(tradeoff.disadvantages, 5))) return false;
  if (new Set(value.tradeoffs.map((tradeoff) => (tradeoff as { scenarioId: string }).scenarioId)).size !== scenarioIds.size) return false;
  return isStringArray(value.risks, 6) && isStringArray(value.nextQuestions, 4);
}

export function stableRecommendationKey(value: RecommendationInput, model: string, promptVersion: string) {
  return stableSerialize({ model, promptVersion, value });
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
