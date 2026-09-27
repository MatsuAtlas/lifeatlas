import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { officialSalaryBenchmarkSource, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";

import { assessCatalogFreshness, buildCatalogCoverage } from "../lib/data/catalog-coverage.ts";

test("reports deterministic coverage for all 71 cities without inflating unsupported calculations", () => {
  const coverage = buildCatalogCoverage(new Date("2026-08-31T00:00:00Z"));
  assert.equal(coverage.summary.cityCount, 71);
  assert.equal(coverage.summary.calculationAvailable, 65);
  assert.equal(coverage.summary.calculationUnavailable, 6);
  assert.equal(coverage.summary.highConfidence + coverage.summary.mediumConfidence + coverage.summary.lowConfidence, 71);
  assert.equal(coverage.summary.containsSavedEstimate, 57);
  assert.equal(coverage.rows.filter((row) => row.calculationStatus === "unavailable").every((row) => row.confidenceLevel === "low"), true);
});

test("separates current, review-due, stale and unknown catalog dates", () => {
  const now = new Date("2026-08-31T00:00:00Z");
  assert.equal(assessCatalogFreshness("2026年8月24日", now).status, "current");
  assert.equal(assessCatalogFreshness("2026-01-01", now).status, "review");
  assert.equal(assessCatalogFreshness("2025-01-01", now).status, "stale");
  assert.equal(assessCatalogFreshness("unknown", now).status, "unknown");
});

test("calculable cities never cite an unsupported tax source, and saved-estimate salaries are not official benchmarks", () => {
  for (const cityId of cityOrder) {
    const city = cities[cityId];
    if (taxCalculationStatus(city) === "unavailable") continue;
    assert.equal(city.dataSources.some((item) => /未対応/.test(`${item.period}${item.source}`)), false, `${cityId} cites an unsupported tax source`);
  }
  for (const cityId of ["sapporo", "fukuoka", "sydney", "brisbane", "perth", "dallas", "sanFrancisco", "miami", "seattle", "yokohama", "nagoya", "kyoto", "ottawa", "edmonton", "austin", "houston", "sanJose", "sanDiego", "manchester", "munich", "frankfurt", "hamburg", "lyon", "adelaide", "canberra", "abuDhabi", "riyadh", "bangalore", "edinburgh", "milan"] as const) {
    assert.equal(officialSalaryBenchmarkSource(cities[cityId]), null, `${cityId} must not expose an official salary benchmark`);
  }
});
