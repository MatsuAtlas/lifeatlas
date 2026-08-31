import assert from "node:assert/strict";
import test from "node:test";

import { simulateWhatIf } from "../lib/calculations/what-if.ts";
import { buildAnalysisCsv } from "../lib/reports/analysis-csv.ts";
import { DEFAULT_PRIORITIES } from "../lib/scoring/life-atlas-score.ts";
import type { SavedAnalyzerInput } from "../types/comparison.ts";

const analysis: SavedAnalyzerInput = {
  kind: "offer-analyzer",
  version: 1,
  scenarios: [
    { id: "tokyo", cityId: "tokyo", annualSalary: 7_000_000, salaryCurrency: "JPY", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" },
    { id: "vancouver", cityId: "vancouver", annualSalary: 90_000, salaryCurrency: "CAD", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" },
  ],
  priorities: DEFAULT_PRIORITIES,
  whatIf: { scenarioId: "vancouver", salaryPercent: 10, rentPercent: 0, exchangePercent: 0 },
  breakEven: { candidateScenarioId: "vancouver", metric: "disposableIncome" },
};

test("creates a bilingual deterministic CSV from the calculated snapshot", () => {
  const snapshot = simulateWhatIf({
    scenarios: analysis.scenarios,
    changes: [{ type: "salaryPercent", scenarioId: "vancouver", percent: 10 }],
    priorities: analysis.priorities,
    breakEven: [{ referenceScenarioId: "tokyo", candidateScenarioId: "vancouver", metric: "disposableIncome" }],
  }).after;
  const japanese = buildAnalysisCsv("ja", analysis, snapshot);
  const english = buildAnalysisCsv("en", analysis, snapshot);

  assert.match(japanese, /"順位","都市","国"/);
  assert.match(japanese, /"東京","日本","JPY"/);
  assert.match(japanese, /"逆転給与"/);
  assert.match(english, /"Rank","City","Country"/);
  assert.match(english, /"Vancouver","Canada","CAD"/);
  assert.match(english, /not professional tax, financial or immigration advice/);
});
