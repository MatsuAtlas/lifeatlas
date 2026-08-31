import assert from "node:assert/strict";
import test from "node:test";

import { isComparisonRecord, isSavedAnalyzerInput, readLocalHistory } from "../lib/comparison-history.ts";
import { DEFAULT_PRIORITIES } from "../lib/scoring/life-atlas-score.ts";
import type { SavedAnalyzerInput } from "../types/comparison.ts";

const savedAnalyzer: SavedAnalyzerInput = {
  kind: "offer-analyzer",
  version: 1,
  scenarios: [
    {
      id: "tokyo-offer",
      cityId: "tokyo",
      annualSalary: 7_000_000,
      salaryCurrency: "JPY",
      age: 29,
      householdType: "single",
      children: 0,
      housing: "onebed",
      lifestyle: "balanced",
    },
    {
      id: "vancouver-offer",
      cityId: "vancouver",
      annualSalary: 90_000,
      salaryCurrency: "CAD",
      age: 29,
      householdType: "single",
      children: 0,
      housing: "onebed",
      lifestyle: "balanced",
    },
  ],
  priorities: { ...DEFAULT_PRIORITIES },
  whatIf: { scenarioId: "vancouver-offer", salaryPercent: 10, rentPercent: -5, exchangePercent: 3 },
  breakEven: { candidateScenarioId: "vancouver-offer", metric: "lifeAtlasScore" },
};

test("accepts a complete saved Offer Analyzer input", () => {
  assert.equal(isSavedAnalyzerInput(savedAnalyzer), true);
  assert.equal(isSavedAnalyzerInput({
    ...savedAnalyzer,
    whatIf: {
      ...savedAnalyzer.whatIf,
      householdType: "couple",
      children: 2,
      customMonthlySpending: 3_000,
      customSavingsTarget: 250_000,
      retirementAge: 62,
      annualReturnRatePercent: 4,
    },
  }), true);
});

test("rejects malformed or unsafe saved Offer Analyzer inputs", () => {
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, scenarios: savedAnalyzer.scenarios.slice(0, 1) }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, scenarios: [savedAnalyzer.scenarios[0], { ...savedAnalyzer.scenarios[1], id: "tokyo-offer" }] }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, scenarios: [{ ...savedAnalyzer.scenarios[0], cityId: "unknown" }, savedAnalyzer.scenarios[1]] }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, priorities: { ...savedAnalyzer.priorities, savings: 6 } }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, whatIf: { ...savedAnalyzer.whatIf, exchangePercent: -100 } }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, whatIf: { ...savedAnalyzer.whatIf, children: 11 } }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, whatIf: { ...savedAnalyzer.whatIf, annualReturnRatePercent: 51 } }), false);
  assert.equal(isSavedAnalyzerInput({ ...savedAnalyzer, breakEven: { ...savedAnalyzer.breakEven, metric: "madeUp" } }), false);
});

test("recognizes complete history records and rejects malformed records", () => {
  const record = {
    id: "local-1",
    title: "東京 vs バンクーバー",
    origin_city: "tokyo",
    destination_city: "vancouver",
    input: savedAnalyzer,
    result: { kind: "offer-analyzer", version: 1 },
    created_at: "2026-08-29T00:00:00.000Z",
  };
  assert.equal(isComparisonRecord(record), true);
  assert.equal(isComparisonRecord({ ...record, result: [] }), false);
  assert.equal(isComparisonRecord({ ...record, created_at: 123 }), false);
});

test("returns no local history during server rendering", () => {
  assert.deepEqual(readLocalHistory(), []);
});
