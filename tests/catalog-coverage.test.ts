import assert from "node:assert/strict";
import test from "node:test";

import { assessCatalogFreshness, buildCatalogCoverage } from "../lib/data/catalog-coverage.ts";

test("reports deterministic coverage for all 50 cities without inflating unsupported calculations", () => {
  const coverage = buildCatalogCoverage(new Date("2026-08-31T00:00:00Z"));
  assert.equal(coverage.summary.cityCount, 50);
  assert.equal(coverage.summary.calculationAvailable, 25);
  assert.equal(coverage.summary.calculationUnavailable, 25);
  assert.equal(coverage.summary.highConfidence + coverage.summary.mediumConfidence + coverage.summary.lowConfidence, 50);
  assert.equal(coverage.summary.containsSavedEstimate, 36);
  assert.equal(coverage.rows.filter((row) => row.calculationStatus === "unavailable").every((row) => row.confidenceLevel === "low"), true);
});

test("separates current, review-due, stale and unknown catalog dates", () => {
  const now = new Date("2026-08-31T00:00:00Z");
  assert.equal(assessCatalogFreshness("2026年8月24日", now).status, "current");
  assert.equal(assessCatalogFreshness("2026-01-01", now).status, "review");
  assert.equal(assessCatalogFreshness("2025-01-01", now).status, "stale");
  assert.equal(assessCatalogFreshness("unknown", now).status, "unknown");
});
