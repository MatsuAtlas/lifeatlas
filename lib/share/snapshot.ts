import { cities } from "../../data/cities.ts";
import { buildWhatIfChanges, simulateWhatIf } from "../calculations/what-if.ts";
import { localizedCity, type SupportedLanguage } from "../cities/localization.ts";
import type { SavedAnalyzerInput } from "../../types/comparison";
import type { ScenarioCalculationOptions } from "../../types/scenario";
import type { WhatIfChange } from "../../types/what-if";
import type { PublicShareSnapshot } from "../../types/share";

// 画面・AI説明と同じ条件変更（buildWhatIfChanges）と為替で計算し、順位の対象と最適候補を一致させます。
export function createPublicShareSnapshot(input: SavedAnalyzerInput, language: SupportedLanguage, calculationOptions?: ScenarioCalculationOptions, access: { whatIf: boolean } = { whatIf: true }): PublicShareSnapshot {
  const target = input.scenarios.find((scenario) => scenario.id === input.whatIf.scenarioId) ?? input.scenarios[0];
  const changes: WhatIfChange[] = access.whatIf ? buildWhatIfChanges(input.whatIf, target) : [];
  const simulation = simulateWhatIf({ scenarios: input.scenarios, changes, priorities: input.priorities, calculationOptions });
  const resultByScenario = new Map(simulation.after.results.map((result) => [result.scenarioId, result]));
  const rankedScores = simulation.after.scores.filter((score) => score.eligible);
  // 順位の対象（計算できる候補）だけから最適候補と2位を選びます。1つもなければ最適候補は出しません。
  const winnerScore = rankedScores[0] ?? null;
  const winnerResult = winnerScore ? resultByScenario.get(winnerScore.scenarioId) ?? null : null;
  const runnerScore = rankedScores[1] ?? null;
  const runnerResult = runnerScore ? resultByScenario.get(runnerScore.scenarioId) : null;
  const winnerName = winnerResult ? localizedCity(cities[winnerResult.cityId], language).name : null;
  const runnerName = runnerResult ? localizedCity(cities[runnerResult.cityId], language).name : null;
  const lead = winnerScore && runnerScore ? Math.round((winnerScore.score - runnerScore.score) * 10) / 10 : null;
  const title = simulation.after.scores
    .map((score) => localizedCity(cities[(resultByScenario.get(score.scenarioId) as NonNullable<typeof winnerResult>).cityId], language).name)
    .join(" vs ")
    .slice(0, 120);
  const unrankedCount = simulation.after.scores.length - rankedScores.length;
  const unrankedNote = unrankedCount === 0 || winnerScore === null ? "" : language === "ja" ? ` 金額を計算できない${unrankedCount}件は順位の対象外です。` : ` ${unrankedCount} option(s) that cannot be calculated are not ranked.`;
  const explanation = (winnerName === null
    ? language === "ja"
      ? "金額を計算できる候補がないため、最適候補はありません。"
      : "No option can be calculated, so there is no best fit."
    : runnerName && lead !== null
      ? language === "ja"
        ? `${winnerName}が${runnerName}をLifeAtlas Scoreで${lead}ポイント上回りました。優先軸とデータ信頼度を含む決定的計算です。`
        : `${winnerName} leads ${runnerName} by ${lead} LifeAtlas Score points after priorities and data confidence are applied.`
      : language === "ja"
        ? `${winnerName}が現在の条件で最上位です。`
        : `${winnerName} ranks first for the current assumptions.`) + unrankedNote;
  const calculationVersion = (resultByScenario.get(simulation.after.scores[0].scenarioId) as NonNullable<typeof winnerResult>).assumptions.calculationVersion;

  return {
    version: 1,
    title,
    language,
    calculationVersion,
    calculatedAt: new Date().toISOString(),
    winnerCityId: winnerResult?.cityId ?? null,
    explanation,
    scenarios: simulation.after.scores.map((score) => {
      const result = resultByScenario.get(score.scenarioId);
      if (!result) throw new Error("SHARE_RESULT_MISSING");
      return {
        cityId: result.cityId,
        rank: score.rank,
        ranked: score.eligible,
        score: score.score,
        currency: result.currency,
        grossAnnual: result.grossAnnual,
        netAnnual: result.netAnnual,
        cashflowBasis: result.cashflow.basis,
        householdNetAnnual: result.cashflow.basis === "household" ? result.cashflow.netAnnual : null,
        totalLivingCostMonthly: result.totalLivingCostMonthly,
        annualSavings: result.annualSavings,
        savingsRate: result.savingsRate,
        rentBurden: result.rentBurden,
        dataConfidence: result.dataConfidence,
        calculationStatus: result.calculationStatus,
        expatTaxRegime: result.assumptions.expatTaxRegime,
        strongestFactors: score.strongestFactors.slice(0, 3),
        riskFlags: score.riskFlags.slice(0, 5),
      };
    }),
  };
}
