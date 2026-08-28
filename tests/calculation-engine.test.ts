import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { convertCurrency, FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { calculateCity, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";
import type { CalculationCity, InsuranceConfig } from "../types/finance.ts";

const noInsurance: InsuranceConfig = {
  healthRateEmployee: 0,
  careRateEmployee: 0,
  childSupportRateEmployee: 0,
  pensionRateEmployee: 0,
  employmentRateEmployee: 0,
  socialSecurityRateEmployee: 0,
  medicareRate: 0,
  employerSuperRate: 0,
  healthInsuranceEmployeeMonthly: 0,
  healthInsuranceFamilyMonthly: 0,
  source: "test fixture",
};

function city(overrides: Partial<CalculationCity>): CalculationCity {
  return {
    taxSystem: "estimate",
    taxRegion: "unsupported",
    insurance: noInsurance,
    averageAnnualIncome: 6_000_000,
    costs: {
      rent: 120_000,
      food: 50_000,
      utilities: 12_000,
      internet: 5_000,
      transport: 10_000,
      medical: 5_000,
      leisure: 20_000,
    },
    scores: { livability: 85, business: 80, nomad: 70, family: 78, safety: 90 },
    dataSources: [],
    ...overrides,
  };
}

test("keeps the complete 50-city catalog available to every product surface", () => {
  assert.equal(cityOrder.length, 50);
  assert.equal(new Set(cityOrder).size, 50);
  assert.deepEqual(Object.keys(cities).sort(), [...cityOrder].sort());
  for (const cityId of cityOrder) {
    assert.equal(cities[cityId].id, cityId);
    assert.ok(cities[cityId].dataSources.length > 0);
  }
});

test("uses one shared and reversible currency conversion contract", () => {
  const cad = convertCurrency(1_000_000, "JPY", "CAD");
  assert.equal(cad, 1_000_000 / FALLBACK_FX_TO_JPY.CAD);
  assert.equal(convertCurrency(cad, "CAD", "JPY"), 1_000_000);
});

test("keeps the Tokyo single-household baseline stable", () => {
  const tokyo = city({
    taxSystem: "japan",
    taxRegion: "tokyo",
    insurance: {
      ...noInsurance,
      healthRateEmployee: 0.04955,
      careRateEmployee: 0.0081,
      childSupportRateEmployee: 0.00115,
      pensionRateEmployee: 0.0915,
      employmentRateEmployee: 0.005,
    },
  });

  const result = calculateCity(tokyo, 7_000_000, "single", "onebed", "balanced", "under40");

  assert.equal(result.taxCalculationStatus, "official-rate-estimate");
  assert.equal(result.taxMonthly, 140_614.85833333334);
  assert.equal(result.netMonthly, 442_718.47500000003);
  assert.equal(result.totalMonthlyCosts, 222_000);
  assert.equal(result.annualSavings, 2_648_621.7);
  assert.equal(result.purchasingPower, 199);
  assert.equal(result.scores.overall, 86);
});

test("keeps household, housing and lifestyle multipliers stable", () => {
  const vancouver = city({
    taxSystem: "canada",
    taxRegion: "britishColumbia",
    averageAnnualIncome: 75_000,
    insurance: {
      ...noInsurance,
      pensionRateEmployee: 0.0595,
      employmentRateEmployee: 0.0163,
      pensionBaseExemption: 3_500,
      pensionAnnualMax: 4_230.45,
      pensionSecondRateEmployee: 0.04,
      pensionSecondStart: 74_600,
      pensionSecondCap: 85_000,
      pensionSecondAnnualMax: 416,
    },
    costs: { rent: 2_600, food: 700, utilities: 180, internet: 90, transport: 140, medical: 100, leisure: 300 },
    scores: { livability: 88, business: 80, nomad: 80, family: 85, safety: 82 },
  });

  const result = calculateCity(vancouver, 90_000, "couple", "twobed", "comfortable", "under40");

  assert.equal(result.rent, 4_030);
  assert.equal(result.livingCosts, 2_925.625);
  assert.equal(result.taxMonthly, 1_826.1868333333334);
  assert.equal(result.monthlyRemaining, -1_281.8118333333332);
  assert.equal(result.annualSavings, 0);
  assert.equal(result.scores.overall, 60);
});

test("does not fabricate a financial result for unsupported tax systems", () => {
  const unsupported = city({ taxSystem: "estimate" });
  const result = calculateCity(unsupported, 8_000_000, "single", "studio", "lean", "under40");

  assert.equal(taxCalculationStatus(unsupported), "unavailable");
  assert.equal(result.calculationUnavailableReason, "tax");
  assert.equal(result.taxBreakdown, null);
  assert.equal(result.netMonthly, null);
  assert.equal(result.annualSavings, null);
  assert.equal(result.scores.overall, null);
});
