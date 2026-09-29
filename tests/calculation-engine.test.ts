import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { convertCurrency, FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { calculateCity, calculateHongKongSalariesTax, calculateIrelandPayrollTax, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";
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
  assert.equal(result.annualSavings, result.monthlyRemaining! * 12);
  assert.ok(result.annualSavings! < 0);
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

test("Hong Kong salaries tax follows the 2026/27 progressive and standard rates with capped MPF", () => {
  // 月50,000HKD：MPFは上限30,000HKDの5%×12=18,000。純所得582,000−基礎控除145,000=437,000に累進税率。
  assert.deepEqual(calculateHongKongSalariesTax(600_000, "single"), { salariesTax: 56_290, mpf: 18_000 });
  // 高所得では標準税率（500万HKDまで15%、超過分16%）が上限。
  assert.deepEqual(calculateHongKongSalariesTax(6_000_000, "single"), { salariesTax: 907_120, mpf: 18_000 });
  // 月7,100HKD未満は従業員のMPF拠出なし、控除内なら税額0。
  assert.deepEqual(calculateHongKongSalariesTax(84_000, "single"), { salariesTax: 0, mpf: 0 });
  // 子ども控除140,000HKD×2、単親控除145,000HKD。
  assert.equal(calculateHongKongSalariesTax(600_000, "family").salariesTax, 9_980);
  assert.equal(calculateHongKongSalariesTax(600_000, "singleParent").salariesTax, 9_280);
});

test("Hong Kong is calculable while keeping its salary benchmark and costs marked as stored estimates", () => {
  const hongKong = cities.hongKong;
  assert.equal(taxCalculationStatus(hongKong), "official-rate-estimate");
  const result = calculateCity(hongKong, 600_000, "single", "onebed", "balanced", "under40");
  assert.equal(result.taxMonthly, (56_290 + 18_000) / 12);
  assert.equal(result.netMonthly, (600_000 - 56_290 - 18_000) / 12);
  assert.equal(result.calculationUnavailableReason, null);
  assert.ok(hongKong.dataSources.some((item) => /Life Atlas保存参考値/.test(item.source)));
  assert.ok(hongKong.dataSources.some((item) => item.url.startsWith("https://www.ird.gov.hk/")));
});

test("Ireland 2026 payroll tax applies bands, credits, USC and time-weighted PRSI", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // €60,000：所得税 8,800+6,400−4,000=11,200、USC 60.06+333.76+939=1,332.82、PRSI 60,000×4.2375%=2,542.5
  const middle = calculateIrelandPayrollTax(60_000);
  close(middle.incomeTax, 11_200);
  close(middle.usc, 1_332.82);
  close(middle.prsi, 2_542.5);
  // €100,000：USCの8%帯（€70,044超）
  const high = calculateIrelandPayrollTax(100_000);
  close(high.incomeTax, 27_200);
  close(high.usc, 4_030.62);
  // €13,000以下はUSC免除、週€352以下はPRSIなし、控除額で所得税0
  assert.deepEqual(calculateIrelandPayrollTax(13_000), { incomeTax: 0, usc: 0, prsi: 0 });
  // €20,000（週€384.62）はPRSIクレジットが一部残る
  close(calculateIrelandPayrollTax(20_000).prsi, (20_000 / 52 * 0.042375 - (12 - (20_000 / 52 - 352) / 6)) * 52);
  assert.equal(taxCalculationStatus(cities.dublin), "official-rate-estimate");
});
