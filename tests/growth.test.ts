import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { isProductEventName, PRODUCT_EVENTS } from "../lib/analytics/events.ts";
import { createPublicShareSnapshot } from "../lib/share/snapshot.ts";
import { cityIdFromSlug, citySlug, comparisonFromSlug, comparisonSlug, SEO_COMPARE_PAIRS } from "../lib/seo/city-slugs.ts";
import type { SavedAnalyzerInput } from "../types/comparison.ts";

const analysis: SavedAnalyzerInput = {
  kind: "offer-analyzer",
  version: 1,
  scenarios: [
    { id: "private-offer-a", cityId: "tokyo", annualSalary: 7_000_000, salaryCurrency: "JPY", age: 31, householdType: "couple", children: 1, housing: "onebed", lifestyle: "balanced", customRent: 200_000 },
    { id: "private-offer-b", cityId: "vancouver", annualSalary: 100_000, salaryCurrency: "CAD", age: 31, householdType: "couple", children: 1, housing: "onebed", lifestyle: "balanced", customMonthlySpending: 2_000 },
  ],
  priorities: { savings: 3, purchasingPower: 3, qualityOfLife: 3, entrepreneurship: 0, fire: 2, family: 3, safety: 3, climate: 0, career: 2, remoteWork: 0 },
  whatIf: { scenarioId: "private-offer-b", salaryPercent: 5, rentPercent: 0, exchangePercent: 0 },
  breakEven: { candidateScenarioId: "private-offer-b", metric: "disposableIncome" },
};

test("creates unique, reversible city slugs for all 50 cities", () => {
  const slugs = cityOrder.map(citySlug);
  assert.equal(slugs.length, 50);
  assert.equal(new Set(slugs).size, 50);
  for (const cityId of cityOrder) assert.equal(cityIdFromSlug(citySlug(cityId)), cityId);
  assert.equal(citySlug("losAngeles"), "los-angeles");
});

test("limits SEO comparison pages to the curated high-quality set", () => {
  assert.equal(SEO_COMPARE_PAIRS.length, 5);
  for (const [cityA, cityB] of SEO_COMPARE_PAIRS) {
    assert.deepEqual(comparisonFromSlug(comparisonSlug(cityA, cityB)), { cityA, cityB });
  }
  assert.equal(comparisonFromSlug("tokyo-vs-paris"), null);
});

test("keeps acquisition, conversion and churn events in the server allowlist", () => {
  for (const eventName of ["signup_completed", "subscription_completed", "subscription_canceled"] as const) {
    assert.equal(isProductEventName(eventName), true);
    assert.ok(PRODUCT_EVENTS.includes(eventName));
  }
  assert.equal(isProductEventName("arbitrary_event"), false);
});

test("builds a deterministic public snapshot without private scenario fields", () => {
  const first = createPublicShareSnapshot(analysis, "ja");
  const second = createPublicShareSnapshot(analysis, "ja");
  assert.deepEqual({ ...first, calculatedAt: "fixed" }, { ...second, calculatedAt: "fixed" });
  assert.equal(first.scenarios.length, 2);
  assert.ok(first.scenarios.every((scenario) => scenario.cityId in cities));
  assert.ok(first.scenarios.some((scenario) => scenario.cityId === "vancouver" && scenario.grossAnnual === 105_000));
  const serialized = JSON.stringify(first);
  for (const privateValue of ["private-offer-a", "private-offer-b"]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue));
  }
  for (const scenario of first.scenarios) {
    for (const privateKey of ["id", "age", "householdType", "children", "customRent", "customMonthlySpending", "customSavingsTarget"]) {
      assert.equal(Object.hasOwn(scenario, privateKey), false);
    }
  }
});
