import { cities } from "../../data/cities.ts";
import { simulateWhatIf } from "../calculations/what-if.ts";
import { localizedCity, type SupportedLanguage } from "../cities/localization.ts";
import type { SavedAnalyzerInput } from "../../types/comparison";
import type { WhatIfChange } from "../../types/what-if";
import type { PublicShareSnapshot } from "../../types/share";

export function createPublicShareSnapshot(input: SavedAnalyzerInput, language: SupportedLanguage): PublicShareSnapshot {
  const target = input.scenarios.find((scenario) => scenario.id === input.whatIf.scenarioId) ?? input.scenarios[0];
  const changes: WhatIfChange[] = [];
  if (input.whatIf.salaryPercent !== 0) changes.push({ type: "salaryPercent", scenarioId: target.id, percent: input.whatIf.salaryPercent });
  if (input.whatIf.rentPercent !== 0) changes.push({ type: "rentPercent", scenarioId: target.id, percent: input.whatIf.rentPercent });
  const targetCurrency = cities[target.cityId].currency;
  if (input.whatIf.exchangePercent !== 0 && targetCurrency !== "JPY") {
    changes.push({ type: "exchangeRatePercent", currency: targetCurrency, percent: input.whatIf.exchangePercent });
  }
  const simulation = simulateWhatIf({ scenarios: input.scenarios, changes, priorities: input.priorities });
  const resultByScenario = new Map(simulation.after.results.map((result) => [result.scenarioId, result]));
  const winnerScore = simulation.after.scores[0];
  const winnerResult = resultByScenario.get(winnerScore.scenarioId);
  if (!winnerResult) throw new Error("SHARE_WINNER_MISSING");
  const runnerScore = simulation.after.scores[1];
  const runnerResult = runnerScore ? resultByScenario.get(runnerScore.scenarioId) : null;
  const winnerName = localizedCity(cities[winnerResult.cityId], language).name;
  const runnerName = runnerResult ? localizedCity(cities[runnerResult.cityId], language).name : null;
  const lead = runnerScore ? Math.round((winnerScore.score - runnerScore.score) * 10) / 10 : null;
  const title = simulation.after.scores
    .map((score) => localizedCity(cities[(resultByScenario.get(score.scenarioId) as typeof winnerResult).cityId], language).name)
    .join(" vs ")
    .slice(0, 120);
  const explanation = runnerName && lead !== null
    ? language === "ja"
      ? `${winnerName}が${runnerName}をLifeAtlas Scoreで${lead}ポイント上回りました。優先軸とデータ信頼度を含む決定的計算です。`
      : `${winnerName} leads ${runnerName} by ${lead} LifeAtlas Score points after priorities and data confidence are applied.`
    : language === "ja"
      ? `${winnerName}が現在の条件で最上位です。`
      : `${winnerName} ranks first for the current assumptions.`;

  return {
    version: 1,
    title,
    language,
    calculationVersion: winnerResult.assumptions.calculationVersion,
    calculatedAt: new Date().toISOString(),
    winnerCityId: winnerResult.cityId,
    explanation,
    scenarios: simulation.after.scores.map((score) => {
      const result = resultByScenario.get(score.scenarioId);
      if (!result) throw new Error("SHARE_RESULT_MISSING");
      return {
        cityId: result.cityId,
        rank: score.rank,
        score: score.score,
        currency: result.currency,
        grossAnnual: result.grossAnnual,
        netAnnual: result.netAnnual,
        totalLivingCostMonthly: result.totalLivingCostMonthly,
        annualSavings: result.annualSavings,
        savingsRate: result.savingsRate,
        rentBurden: result.rentBurden,
        dataConfidence: result.dataConfidence,
        calculationStatus: result.calculationStatus,
        strongestFactors: score.strongestFactors.slice(0, 3),
        riskFlags: score.riskFlags.slice(0, 5),
      };
    }),
  };
}
