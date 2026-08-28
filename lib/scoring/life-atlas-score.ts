import { cities } from "../../data/cities.ts";
import type { PriorityKey, ScenarioResult, ScenarioScore, UserPriorities } from "../../types/scenario";

export const LIFE_ATLAS_SCORE_WEIGHTS = {
  financial: 0.45,
  lifestyle: 0.2,
  preference: 0.25,
  confidence: 0.1,
} as const;

export const DEFAULT_PRIORITIES: UserPriorities = {
  savings: 3,
  purchasingPower: 3,
  qualityOfLife: 3,
  entrepreneurship: 0,
  fire: 2,
  family: 0,
  safety: 3,
  climate: 0,
  career: 2,
  remoteWork: 0,
};

const priorityKeys = Object.keys(DEFAULT_PRIORITIES) as PriorityKey[];
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundScore = (value: number) => Math.round(value * 10) / 10;

function relativeScore(value: number | null, values: number[]) {
  if (value === null || values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? 50 : clamp(((value - min) / (max - min)) * 100);
}

function validateInputs(results: ScenarioResult[], priorities: UserPriorities) {
  if (results.length < 2 || results.length > 5) throw new RangeError("LifeAtlas Score requires between 2 and 5 scenarios.");
  if (new Set(results.map((result) => result.scenarioId)).size !== results.length) throw new RangeError("Scenario IDs must be unique.");
  for (const key of priorityKeys) {
    if (!Number.isFinite(priorities[key]) || priorities[key] < 0 || priorities[key] > 5) {
      throw new RangeError(`${key} priority must be between 0 and 5.`);
    }
  }
}

function financialMetrics(result: ScenarioResult, savingsValues: number[], netValues: number[]) {
  const savingsRate = result.savingsRate === null ? 0 : clamp(((result.savingsRate + 20) / 70) * 100);
  const annualSavings = relativeScore(result.annualSavingsJpy, savingsValues);
  const disposableIncome = relativeScore(result.netAnnualJpy, netValues);
  const purchasingPower = result.purchasingPowerIndex === null ? 0 : clamp(((result.purchasingPowerIndex - 50) / 250) * 100);
  const housingAffordability = result.rentBurden === null ? 0 : clamp(100 - result.rentBurden * 1.5);
  const fireTrajectory = result.fire?.yearsToTarget === null || result.fire?.yearsToTarget === undefined
    ? 0
    : clamp(100 - result.fire.yearsToTarget * 2);
  const score = savingsRate * 0.25
    + annualSavings * 0.25
    + disposableIncome * 0.15
    + purchasingPower * 0.15
    + housingAffordability * 0.1
    + fireTrajectory * 0.1;
  return { savingsRate, annualSavings, disposableIncome, purchasingPower, housingAffordability, fireTrajectory, score };
}

function lifestyleMetrics(result: ScenarioResult) {
  const city = cities[result.cityId];
  const score = city.scores.livability * 0.45 + city.scores.family * 0.2 + city.scores.safety * 0.2 + city.scores.nomad * 0.15;
  return {
    qualityOfLife: city.scores.livability,
    family: city.scores.family,
    safety: city.scores.safety,
    remoteWork: city.scores.nomad,
    entrepreneurship: city.scores.business,
    career: city.scores.business,
    score,
  };
}

export function scoreScenarios(results: ScenarioResult[], priorities: UserPriorities = DEFAULT_PRIORITIES): ScenarioScore[] {
  validateInputs(results, priorities);
  const savingsValues = results.flatMap((result) => result.annualSavingsJpy === null ? [] : [result.annualSavingsJpy]);
  const netValues = results.flatMap((result) => result.netAnnualJpy === null ? [] : [result.netAnnualJpy]);

  const scored = results.map((result): ScenarioScore => {
    const financial = financialMetrics(result, savingsValues, netValues);
    const lifestyle = lifestyleMetrics(result);
    const preferenceMetrics: Partial<Record<PriorityKey, number>> = {
      savings: (financial.savingsRate + financial.annualSavings) / 2,
      purchasingPower: financial.purchasingPower,
      qualityOfLife: lifestyle.qualityOfLife,
      entrepreneurship: lifestyle.entrepreneurship,
      fire: financial.fireTrajectory,
      family: lifestyle.family,
      safety: lifestyle.safety,
      career: lifestyle.career,
      remoteWork: lifestyle.remoteWork,
    };
    const omittedPriorities: PriorityKey[] = [];
    let preferenceTotal = 0;
    let preferenceWeight = 0;
    for (const key of priorityKeys) {
      const weight = priorities[key];
      if (weight === 0) continue;
      const metric = preferenceMetrics[key];
      if (metric === undefined) {
        omittedPriorities.push(key);
        continue;
      }
      preferenceTotal += metric * weight;
      preferenceWeight += weight;
    }
    const preferenceScore = preferenceWeight === 0 ? 50 : preferenceTotal / preferenceWeight;
    const confidenceScore = result.dataConfidence.score;
    const contributions = {
      financial: financial.score * LIFE_ATLAS_SCORE_WEIGHTS.financial,
      lifestyle: lifestyle.score * LIFE_ATLAS_SCORE_WEIGHTS.lifestyle,
      preference: preferenceScore * LIFE_ATLAS_SCORE_WEIGHTS.preference,
      confidence: confidenceScore * LIFE_ATLAS_SCORE_WEIGHTS.confidence,
    };
    const rawScore = contributions.financial + contributions.lifestyle + contributions.preference + contributions.confidence;
    const eligible = result.calculationStatus !== "unavailable" && result.netAnnual !== null;
    const score = roundScore(eligible ? rawScore : Math.min(35, rawScore * 0.5));
    const factorScores = [
      ["savings-rate", financial.savingsRate],
      ["annual-savings", financial.annualSavings],
      ["disposable-income", financial.disposableIncome],
      ["purchasing-power", financial.purchasingPower],
      ["housing-affordability", financial.housingAffordability],
      ["fire-trajectory", financial.fireTrajectory],
      ["quality-of-life", lifestyle.qualityOfLife],
      ["family", lifestyle.family],
      ["safety", lifestyle.safety],
      ["remote-work", lifestyle.remoteWork],
      ["data-confidence", confidenceScore],
    ] as Array<[string, number]>;
    const strongestFactors = [...factorScores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([name]) => name);
    const weakestFactors = [...factorScores].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([name]) => name);
    const riskFlags = [
      ...(!eligible ? ["calculation-unavailable"] : []),
      ...(result.annualSavings !== null && result.annualSavings < 0 ? ["negative-savings"] : []),
      ...(result.rentBurden !== null && result.rentBurden > 40 ? ["high-housing-burden"] : []),
      ...(confidenceScore < 60 ? ["low-data-confidence"] : []),
      ...(result.fire !== null && result.fire.yearsToTarget === null ? ["fire-target-unreachable"] : []),
    ];
    return {
      scenarioId: result.scenarioId,
      eligible,
      score,
      rank: 0,
      financialScore: roundScore(financial.score),
      lifestyleScore: roundScore(lifestyle.score),
      preferenceScore: roundScore(preferenceScore),
      confidenceScore: roundScore(confidenceScore),
      strongestFactors,
      weakestFactors,
      omittedPriorities,
      riskFlags,
      contributions: {
        financial: roundScore(contributions.financial),
        lifestyle: roundScore(contributions.lifestyle),
        preference: roundScore(contributions.preference),
        confidence: roundScore(contributions.confidence),
      },
    };
  });

  return scored
    .sort((a, b) => Number(b.eligible) - Number(a.eligible)
      || b.score - a.score
      || b.confidenceScore - a.confidenceScore
      || a.scenarioId.localeCompare(b.scenarioId))
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
