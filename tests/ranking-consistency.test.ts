import assert from "node:assert/strict";
import test from "node:test";

import { buildRecommendationInput, RecommendationUnavailableError } from "../lib/ai/recommendation.ts";
import { buildWhatIfChanges, simulateWhatIf } from "../lib/calculations/what-if.ts";
import { buildAnalysisCsv } from "../lib/reports/analysis-csv.ts";
import { createPublicShareSnapshot } from "../lib/share/snapshot.ts";
import type { SavedAnalyzerInput } from "../types/comparison.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const priorities = { savings: 3, purchasingPower: 3, qualityOfLife: 3, entrepreneurship: 0, fire: 2, family: 3, safety: 3, climate: 0, career: 2, remoteWork: 0 };
const couple = (id: string, cityId: ScenarioInput["cityId"], spouseAnnualSalary?: number): ScenarioInput => ({ id, cityId, annualSalary: 140_000, salaryCurrency: "USD", age: 35, householdType: "couple", children: 0, housing: "onebed", lifestyle: "balanced", ...(spouseAnnualSalary === undefined ? {} : { spouseAnnualSalary }) });
const analysisOf = (scenarios: ScenarioInput[]): SavedAnalyzerInput => ({
  kind: "offer-analyzer",
  version: 1,
  scenarios,
  priorities,
  whatIf: { scenarioId: scenarios[0].id, salaryPercent: 0, rentPercent: 0, exchangePercent: 0 },
  breakEven: { candidateScenarioId: scenarios[1].id, metric: "disposableIncome" },
});

// CSVの候補の表（最初の空行まで）から、順位と都市名を読み出します。都市名の順に並べて返します。
function csvRanks(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const end = lines.indexOf("", 1);
  return lines.slice(1, end === -1 ? undefined : end).map((line) => line.split(",").slice(0, 2).map((cell) => cell.replaceAll('"', ""))).sort((a, b) => a[1].localeCompare(b[1]));
}

test("when no option can be calculated, share, AI and CSV show no best fit and no ranks", () => {
  const analysis = analysisOf([couple("ny", "newYork"), couple("chicago", "chicago")]);
  const snapshot = createPublicShareSnapshot(analysis, "ja");
  assert.equal(snapshot.winnerCityId, null);
  assert.ok(snapshot.scenarios.every((scenario) => scenario.ranked === false));
  assert.match(snapshot.explanation, /最適候補はありません/);

  assert.throws(() => buildRecommendationInput(analysis, "ja"), RecommendationUnavailableError);

  const simulation = simulateWhatIf({ scenarios: analysis.scenarios, changes: [], priorities });
  const rows = csvRanks(buildAnalysisCsv("ja", analysis, simulation.after));
  assert.deepEqual(rows.map(([rank]) => rank), ["順位なし", "順位なし"]);
});

test("when only some options can be calculated, the others are unranked everywhere", () => {
  const analysis = analysisOf([couple("tokyo", "tokyo", 0), couple("ny", "newYork", 0)]);
  const snapshot = createPublicShareSnapshot(analysis, "en");
  assert.equal(snapshot.winnerCityId, "newYork");
  assert.deepEqual(snapshot.scenarios.map((scenario) => [scenario.cityId, scenario.ranked]), [["newYork", true], ["tokyo", false]]);
  assert.match(snapshot.explanation, /1 option\(s\) that cannot be calculated are not ranked/);

  const ai = buildRecommendationInput(analysis, "en");
  assert.equal(ai.winnerScenarioId, "ny");
  assert.deepEqual(ai.scenarios.map((scenario) => [scenario.scenarioId, scenario.rank, scenario.ranked]), [["ny", 1, true], ["tokyo", null, false]]);
  assert.equal(ai.scenarios.find((scenario) => scenario.scenarioId === "ny")?.financials.cashflowBasis, "household");

  const simulation = simulateWhatIf({ scenarios: analysis.scenarios, changes: [], priorities });
  const rows = csvRanks(buildAnalysisCsv("en", analysis, simulation.after));
  assert.deepEqual(rows, [["1", "New York"], ["Not ranked", "Tokyo"]]);
});

test("What-If shows no score or rank change when an option becomes (un)rankable, with the reason", () => {
  const single: ScenarioInput = { ...couple("ny", "newYork"), householdType: "single" };
  const chicago = couple("chicago", "chicago", 0);
  const toUnknownCouple = simulateWhatIf({ scenarios: [single, chicago], changes: [{ type: "household", scenarioId: "ny", householdType: "couple" }], priorities });
  const lost = toUnknownCouple.deltas.find((delta) => delta.scenarioId === "ny");
  assert.equal(lost?.score, null);
  assert.equal(lost?.rankChange, null);
  assert.deepEqual(lost?.rankingChange, { direction: "becameUnranked", reason: "household" });
  // もう一方は順位の対象のままなので、変化を数値で示します。
  const other = toUnknownCouple.deltas.find((delta) => delta.scenarioId === "chicago");
  assert.equal(typeof other?.score, "number");
  assert.equal(other?.rankingChange, null);

  const backToSingle = simulateWhatIf({ scenarios: [couple("ny", "newYork"), chicago], changes: [{ type: "household", scenarioId: "ny", householdType: "single" }], priorities });
  const gained = backToSingle.deltas.find((delta) => delta.scenarioId === "ny");
  assert.equal(gained?.score, null);
  assert.deepEqual(gained?.rankingChange, { direction: "becameRanked", reason: "household" });

  const stays = simulateWhatIf({ scenarios: [single, chicago], changes: [{ type: "salaryPercent", scenarioId: "ny", percent: 10 }], priorities }).deltas.find((delta) => delta.scenarioId === "ny");
  assert.equal(typeof stays?.score, "number");
  assert.equal(typeof stays?.rankChange, "number");
  assert.equal(stays?.rankingChange, null);
});

test("share applies the saved What-If household change like the screen and AI", () => {
  // ニューヨーク：単身$140,000／シカゴ：夫婦$60,000・配偶者は空欄。What-Ifでニューヨークを夫婦（配偶者未入力）へ。
  const analysis: SavedAnalyzerInput = {
    ...analysisOf([{ ...couple("ny", "newYork"), householdType: "single" }, { ...couple("chicago", "chicago"), annualSalary: 60_000 }]),
    whatIf: { scenarioId: "ny", salaryPercent: 0, rentPercent: 0, exchangePercent: 0, householdType: "couple" },
  };
  const snapshot = createPublicShareSnapshot(analysis, "ja");
  assert.equal(snapshot.winnerCityId, null);
  assert.deepEqual(snapshot.scenarios.map((scenario) => scenario.ranked), [false, false]);
  assert.throws(() => buildRecommendationInput(analysis, "ja"), RecommendationUnavailableError);
});

test("screen, share, CSV and AI agree on ranked options and the best fit when only some can be calculated", () => {
  const analysis: SavedAnalyzerInput = {
    ...analysisOf([couple("ny", "newYork", 0), couple("tokyo", "tokyo", 0), couple("boston", "boston", 50_000)]),
    whatIf: { scenarioId: "ny", salaryPercent: 10, rentPercent: 5, exchangePercent: 0, householdType: "couple", children: 1 },
  };
  // 画面と同じ計算（保存されたWhat-Ifを共通ビルダーで組み立てる）
  const target = analysis.scenarios[0];
  const screen = simulateWhatIf({ scenarios: analysis.scenarios, changes: buildWhatIfChanges(analysis.whatIf, target), priorities });
  const screenRanked = new Map(screen.after.scores.map((score) => [score.scenarioId, score.eligible]));
  const screenWinner = screen.after.scores.find((score) => score.eligible)?.scenarioId ?? null;
  const cityOf = new Map(screen.after.results.map((result) => [result.scenarioId, result.cityId]));
  assert.deepEqual([...screenRanked.entries()].sort(), [["boston", true], ["ny", true], ["tokyo", false]]);

  const snapshot = createPublicShareSnapshot(analysis, "en");
  assert.equal(snapshot.winnerCityId, screenWinner === null ? null : cityOf.get(screenWinner));
  for (const scenario of snapshot.scenarios) {
    const id = [...cityOf.entries()].find(([, cityId]) => cityId === scenario.cityId)?.[0] as string;
    assert.equal(scenario.ranked, screenRanked.get(id), scenario.cityId);
  }

  const ai = buildRecommendationInput(analysis, "en");
  assert.equal(ai.winnerScenarioId, screenWinner);
  for (const scenario of ai.scenarios) assert.equal(scenario.ranked, screenRanked.get(scenario.scenarioId));

  const rows = csvRanks(buildAnalysisCsv("en", analysis, screen.after));
  const screenRankByCity = new Map(screen.after.scores.map((score) => [cityOf.get(score.scenarioId), score.eligible ? String(score.rank) : "Not ranked"]));
  for (const [rank, cityName] of rows) {
    const cityId = cityName === "New York" ? "newYork" : cityName === "Tokyo" ? "tokyo" : "boston";
    assert.equal(rank, screenRankByCity.get(cityId), cityName);
  }
});
