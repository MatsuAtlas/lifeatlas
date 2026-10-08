import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { officialSalaryBenchmarkSource, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";

import { assessCatalogFreshness, buildCatalogCoverage } from "../lib/data/catalog-coverage.ts";

test("reports deterministic coverage for all 71 cities without inflating unsupported calculations", () => {
  const coverage = buildCatalogCoverage(new Date("2026-08-31T00:00:00Z"));
  assert.equal(coverage.summary.cityCount, 71);
  assert.equal(coverage.summary.calculationAvailable, 71);
  assert.equal(coverage.summary.calculationUnavailable, 0);
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
  for (const cityId of ["sapporo", "fukuoka", "sydney", "brisbane", "perth", "dallas", "sanFrancisco", "miami", "seattle", "yokohama", "nagoya", "kyoto", "ottawa", "edmonton", "austin", "houston", "sanJose", "sanDiego", "manchester", "munich", "frankfurt", "hamburg", "lyon", "adelaide", "canberra", "abuDhabi", "riyadh", "bangalore", "edinburgh", "milan", "lisbon", "madrid", "bogota", "buenosAires", "santiago"] as const) {
    assert.equal(officialSalaryBenchmarkSource(cities[cityId]), null, `${cityId} must not expose an official salary benchmark`);
  }
});

test("Canadian city rents use CMHC's October 2025 one-bedroom turnover-unit averages", () => {
  const expected = { vancouver: 2_107, toronto: 2_073, montreal: 1_327, calgary: 1_562, ottawa: 1_738, edmonton: 1_305 } as const;
  for (const [cityId, rent] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    assert.equal(cities[cityId].costs.rent, rent, cityId);
    assert.ok(cities[cityId].dataSources.some((item) => item.source.startsWith("Canada Mortgage and Housing Corporation") && item.item.startsWith("家賃")), cityId);
  }
});

test("US city rents use HUD's FY2026 one-bedroom Fair Market Rents", () => {
  const expected = { newYork: 2_655, losAngeles: 2_085, sanFrancisco: 2_977, sanJose: 2_982, sanDiego: 2_459, seattle: 2_146, chicago: 1_581, boston: 2_476, washingtonDc: 2_015, dallas: 1_648, houston: 1_323, austin: 1_562, miami: 1_995 } as const;
  for (const [cityId, rent] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    assert.equal(cities[cityId].costs.rent, rent, cityId);
    assert.ok(cities[cityId].dataSources.some((item) => item.source.startsWith("U.S. Department of Housing and Urban Development") && item.item.startsWith("家賃")), cityId);
  }
});

test("UK city rents use ONS Price Index of Private Rents one-bedroom averages for August 2026", () => {
  const expected = { london: 1_760, manchester: 1_003, edinburgh: 1_035 } as const;
  for (const [cityId, rent] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    assert.equal(cities[cityId].costs.rent, rent, cityId);
    assert.ok(cities[cityId].dataSources.some((item) => item.source.startsWith("Office for National Statistics・Price Index of Private Rents") && item.item.startsWith("家賃")), cityId);
  }
});
