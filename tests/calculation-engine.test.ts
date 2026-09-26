import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { convertCurrency, FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { calculateCity, calculateHongKongSalariesTax, calculateIrelandPayrollTax, calculateGermanyPayroll, calculateThailandPayroll, calculateChinaPayroll, calculatePhilippinesPayroll, calculateVietnamPayroll, calculateBrazilPayroll, germanIncomeTax2026, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";
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

test("Massachusetts, Illinois and DC 2026 state income tax is added to the federal tax", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const incomeTax = (cityId: "boston" | "chicago" | "washingtonDc", gross: number) => (calculateCity(cities[cityId], gross, "single", "onebed", "balanced", "under40").taxBreakdown?.incomeTaxMonthly ?? 0) * 12;
  // 連邦（$100,000・標準控除$16,100）：1,240+4,560+7,370=13,170
  close(incomeTax("boston", 100_000), 13_170 + (100_000 - 4_400) * 0.05);
  close(incomeTax("chicago", 100_000), 13_170 + (100_000 - 2_925) * 0.0495);
  close(incomeTax("washingtonDc", 100_000), 13_170 + 400 + 1_800 + 1_300 + 23_900 * 0.085);
  // イリノイは連邦AGI$250,000超で控除なし。マサチューセッツは課税所得$1,107,750超に4%加算。
  const federal300k = incomeTax("chicago", 300_000) - 300_000 * 0.0495;
  close(incomeTax("boston", 300_000) - federal300k, (300_000 - 4_400) * 0.05);
  const federal2m = incomeTax("chicago", 2_000_000) - 2_000_000 * 0.0495;
  close(incomeTax("boston", 2_000_000) - federal2m, 1_995_600 * 0.05 + (1_995_600 - 1_107_750) * 0.04);
  for (const cityId of ["boston", "chicago", "washingtonDc"] as const) assert.equal(taxCalculationStatus(cities[cityId]), "official-rate-estimate");
});

test("Alberta 2026 provincial tax uses the 8% first bracket and an 8% basic personal credit", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const incomeTax = (gross: number) => (calculateCity(cities.calgary, gross, "single", "onebed", "balanced", "under40").taxBreakdown?.incomeTaxMonthly ?? 0) * 12;
  // 連邦（$100,000・基礎控除$16,452）：58,523×14% + 25,025×20.5% = 13,323.345
  // 州：61,200×8% + 38,800×10% − 22,769×8% = 6,954.48
  close(incomeTax(100_000), 13_323.345 + 6_954.48);
  // $300,000：4,896 + 9,305.9 + 3,702.24 + 8,021.26 + 7,446.18 − 1,821.52 = 31,550.06
  const federal300k = 8_193.22 + (117_045 - 58_523) * 0.205 + (181_440 - 117_045) * 0.26 + (258_482 - 181_440) * 0.29 + (300_000 - 16_452 - 258_482) * 0.33;
  close(incomeTax(300_000), federal300k + 31_550.06);
  // 基礎控除以下では州税0
  close(incomeTax(20_000), (20_000 - 16_452) * 0.14);
  assert.equal(taxCalculationStatus(cities.calgary), "official-rate-estimate");
});

test("Quebec 2026 applies the federal abatement, Quebec brackets, QPP, Quebec EI and QPIP", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const breakdown = calculateCity(cities.montreal, 100_000, "single", "onebed", "balanced", "under40").taxBreakdown;
  // 連邦基本税13,323.345×(1−16.5%)＋州税（7,608.3＋8,674.45−18,952×14%）
  close((breakdown?.incomeTaxMonthly ?? 0) * 12, 13_323.345 * 0.835 + 13_629.47);
  // QPP：上限4,479.30＋QPP2 10,400×4%＝416
  close((breakdown?.pensionMonthly ?? 0) * 12, 4_895.3);
  // EI（ケベック上限895.70）＋QPIP 100,000×0.455%
  close((breakdown?.employmentInsuranceMonthly ?? 0) * 12, 895.7 + 455);
  assert.equal(taxCalculationStatus(cities.montreal), "official-rate-estimate");
});

test("Germany 2026 applies the §32a tariff, solidarity surcharge and capped social insurance", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 税率表の各区間
  assert.equal(germanIncomeTax2026(12_348), 0);
  assert.equal(germanIncomeTax2026(46_674), 9_399);
  assert.equal(germanIncomeTax2026(131_770), 44_207);
  // €60,000・子どもなし：年金5,580、失業780、医療5,250、介護1,440。課税所得 60,000−1,266−(5,580+5,040+1,440)=46,674
  const middle = calculateGermanyPayroll(60_000, "single");
  close(middle.pension, 5_580);
  close(middle.unemployment, 780);
  close(middle.health, 5_250);
  close(middle.care, 1_440);
  assert.equal(middle.incomeTax, 9_399);
  assert.equal(middle.solidarity, 0);
  // €150,000：上限額が効き、所得税44,207、連帯付加税 44,207×5.5%
  const high = calculateGermanyPayroll(150_000, "single");
  close(high.pension, 101_400 * 0.093);
  close(high.health, 69_750 * 0.0875);
  assert.equal(high.incomeTax, 44_207);
  close(high.solidarity, 44_207 * 0.055);
  // 子ども2人は介護保険料率1.55%
  close(calculateGermanyPayroll(60_000, "family").care, 60_000 * 0.0155);
  assert.equal(taxCalculationStatus(cities.berlin), "official-rate-estimate");
});

test("Thailand 2026 caps social security at 875 baht a month and applies the progressive rates", () => {
  // ฿1,200,000：社会保険 875×12=10,500、課税所得 1,200,000−100,000−60,000−10,500=1,029,500
  // 税額 7,500+20,000+37,500+50,000+29,500×25%=122,375
  assert.deepEqual(calculateThailandPayroll(1_200_000), { incomeTax: 122_375, socialSecurity: 10_500 });
  // ฿300,000：課税所得129,500は非課税枠内
  assert.deepEqual(calculateThailandPayroll(300_000), { incomeTax: 0, socialSecurity: 10_500 });
  // 月給฿10,000は上限未満：社会保険は5%
  assert.equal(calculateThailandPayroll(120_000).socialSecurity, 6_000);
  assert.equal(taxCalculationStatus(cities.bangkok), "official-rate-estimate");
});

test("China 2026 uses city contribution bases (time-weighted) and the comprehensive income tax table", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 北京¥600,000（上限超）：(35,811×10.5%+3)×6 + (36,348×10.5%+3)×6 = 45,496.17
  const beijing = calculateChinaPayroll(600_000, "beijing");
  close(beijing.socialInsurance, 45_496.17);
  // 課税所得494,503.83：1,080+10,800+31,200+30,000+74,503.83×30%
  close(beijing.incomeTax, 95_431.149);
  // 上海¥120,000（月¥10,000は上下限内）：社会保険12,600、課税所得47,400 → 1,080+1,140
  const shanghai = calculateChinaPayroll(120_000, "shanghai");
  close(shanghai.socialInsurance, 12_600);
  close(shanghai.incomeTax, 2_220);
  // 下限未満は下限の基数で計算
  close(calculateChinaPayroll(60_000, "shanghai").socialInsurance, 7_460 * 0.105 * 6 + 7_546 * 0.105 * 6);
  assert.equal(taxCalculationStatus(cities.beijing), "official-rate-estimate");
  assert.equal(taxCalculationStatus(cities.shanghai), "official-rate-estimate");
});

test("Philippines 2026 deducts SSS, PhilHealth and Pag-IBIG before the progressive tax", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // ₱1,200,000（月₱100,000）：SSS 1,750、PhilHealth 2,500、Pag-IBIG 200 → 年53,400。課税所得1,146,600
  const high = calculatePhilippinesPayroll(1_200_000);
  close(high.socialInsurance, 53_400);
  close(high.incomeTax, 22_500 + 80_000 + 346_600 * 0.25);
  // ₱300,000（月₱25,000）：SSS 1,250、PhilHealth 625、Pag-IBIG 200 → 年24,900。課税所得275,100
  const low = calculatePhilippinesPayroll(300_000);
  close(low.socialInsurance, 24_900);
  close(low.incomeTax, 25_100 * 0.15);
  assert.equal(taxCalculationStatus(cities.manila), "official-rate-estimate");
});

test("Vietnam 2026 applies the five-bracket monthly table, the new personal deduction and capped insurance", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1, `${actual} != ${expected}`);
  // 月₫100百万：1〜6月 保険 46.8百万×9.5%＋1百万=5.446百万、課税79.054百万 → 0.5+3+7.5+19.054×30%
  //            7〜12月 保険 50.6百万×9.5%＋1百万=5.807百万、課税78.693百万 → 0.5+3+7.5+18.693×30%
  const high = calculateVietnamPayroll(1_200_000_000);
  close(high.socialInsurance, (5_446_000 + 5_807_000) * 6);
  close(high.incomeTax, (16_716_200 + 16_607_900) * 6);
  // 月₫20百万：保険2.1百万、課税2.4百万×5%
  const low = calculateVietnamPayroll(240_000_000);
  close(low.socialInsurance, 2_100_000 * 12);
  close(low.incomeTax, 120_000 * 12);
  assert.equal(taxCalculationStatus(cities.hoChiMinh), "official-rate-estimate");
});

test("Brazil 2026 applies progressive INSS, the monthly table and the Law 15.270 reduction", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.05, `${actual} != ${expected}`);
  const inssAtCeiling = 1_621 * 0.075 + 1_281.84 * 0.09 + 1_451.43 * 0.12 + 4_121.28 * 0.14;
  // 月R$20,000：INSSは上限、所得税は27.5%帯（公式の控除額908.73とも一致）
  const high = calculateBrazilPayroll(240_000);
  close(high.socialInsurance / 12, inssAtCeiling);
  close(high.incomeTax / 12, (20_000 - inssAtCeiling) * 0.275 - 908.73);
  // 月R$6,000：減額 978.62−0.133145×6,000
  const middle = calculateBrazilPayroll(72_000);
  const inss6000 = 1_621 * 0.075 + 1_281.84 * 0.09 + 1_451.43 * 0.12 + (6_000 - 4_354.27) * 0.14;
  close(middle.incomeTax / 12, (6_000 - inss6000) * 0.275 - 908.73 - (978.62 - 0.133145 * 6_000));
  // 月R$5,000以下は所得税0
  assert.equal(calculateBrazilPayroll(60_000).incomeTax, 0);
  assert.equal(taxCalculationStatus(cities.saoPaulo), "official-rate-estimate");
});
