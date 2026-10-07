import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { convertCurrency, FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { calculateCity, calculateHongKongSalariesTax, calculateIrelandPayrollTax, calculateGermanyPayroll, calculateThailandPayroll, calculateChinaPayroll, calculatePhilippinesPayroll, calculateVietnamPayroll, calculateBrazilPayroll, calculateIndiaIncomeTax, calculateNetherlandsPayroll, netherlandsLabourCredit2026, calculateTaiwanPayroll, calculateIndonesiaPayroll, calculateMalaysiaPayroll, calculateKoreaPayroll, koreaEarnedIncomeDeduction2026, koreaEarnedIncomeTaxCredit2026, calculatePortugalPayroll, calculateSpainMadridPayroll, calculateChilePayroll, calculateColombiaPayroll, calculateArgentinaPayroll, calculateFrancePayroll, calculateItalyPayroll, italyEmployeeTaxCredit2026, italyAdditionalCredit2026, calculateZurichPayroll, swissFederalIncomeTax2026, zurichSimpleStateTax2026, germanIncomeTax2026, taxCalculationStatus } from "../lib/calculations/legacy-engine.ts";
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

test("keeps the complete 71-city catalog available to every product surface", () => {
  assert.equal(cityOrder.length, 71);
  assert.equal(new Set(cityOrder).size, 71);
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
  assert.ok(Math.abs((result.taxMonthly ?? 0) - 1_817.21984) < 1e-6);
  assert.ok(Math.abs((result.monthlyRemaining ?? 0) - (-1_281.8118333333332 + 1_826.1868333333334 - 1_817.21984)) < 1e-6);
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

test("Netherlands 2026 Box 1 applies bands and both tax credits, and stays unavailable for ages that may be past the AOW age", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // €60,000：Box 1 38,883×35.75%＋21,117×37.56%＝21,832.22、一般控除 3,115−30,264×6.398%＝1,178.71、
  // 労働控除 5,685−14,408×6.51%＝4,747.04 → 15,906.47
  const middle = calculateNetherlandsPayroll(60_000);
  assert.ok(middle);
  close(middle.box1, 21_832.2177);
  close(middle.generalCredit, 1_178.70928);
  close(middle.labourCredit, 4_747.0392);
  close(middle.box1AfterCredits, 15_906.46922);
  // €100,000：49.50%帯、€78,426以上で一般控除0、労働控除 5,685−54,408×6.51%＝2,143.04
  const high = calculateNetherlandsPayroll(100_000);
  assert.ok(high);
  close(high.box1, 39_432.1533);
  assert.equal(high.generalCredit, 0);
  close(high.labourCredit, 2_143.0392);
  close(high.box1AfterCredits, 37_289.1141);
  // 労働控除は負にならない（€140,000では0）
  assert.equal(calculateNetherlandsPayroll(140_000)?.labourCredit, 0);
  // €45,592ちょうどは労働控除が最大€5,685（3区間目の上限）
  const boundary = calculateNetherlandsPayroll(45_592);
  close(boundary.labourCredit, 5_685.0665);
  close(boundary.generalCredit, 2_100.53312);
  // 労働控除の積み上げ区間（Tabel arbeidskorting 2026）
  close(netherlandsLabourCredit2026(10_000), 832.4);
  close(netherlandsLabourCredit2026(11_965), 995.9666);
  close(netherlandsLabourCredit2026(20_000), 996 + 8_035 * 0.31009);
  close(netherlandsLabourCredit2026(25_845), 996 + 13_880 * 0.31009);
  close(netherlandsLabourCredit2026(30_000), 5_381.0225);
  assert.equal(netherlandsLabourCredit2026(132_921), 0);
  // €30,000：Box 1 10,725、一般控除 3,115−264×6.398%＝3,098.11、労働控除 5,300＋4,155×1.95%＝5,381.02 → 2,245.87
  close(calculateNetherlandsPayroll(30_000).box1AfterCredits, 2_245.86822);
  // €10,000：控除合計がBox 1の税額を超えるため0（還付しない）
  assert.equal(calculateNetherlandsPayroll(10_000).box1AfterCredits, 0);

  const amsterdam = cities.amsterdam;
  assert.equal(taxCalculationStatus(amsterdam), "official-rate-estimate");
  const result = calculateCity(amsterdam, 60_000, "single", "onebed", "balanced", "under40");
  close(result.taxMonthly ?? Number.NaN, 15_906.46922 / 12);
  close(result.netMonthly ?? Number.NaN, (60_000 - 15_906.46922) / 12);
  assert.equal(result.calculationUnavailableReason, null);
  close(calculateCity(amsterdam, 30_000, "single", "onebed", "balanced", "under40").taxMonthly ?? Number.NaN, 2_245.86822 / 12);
  // AOW年齢（67歳）以上かを年齢帯から判定できない65歳以上は、推測せず計算不能にします。
  for (const unavailable of [calculateCity(amsterdam, 60_000, "single", "onebed", "balanced", "65plus")]) {
    assert.equal(unavailable.taxBreakdown, null);
    assert.equal(unavailable.netMonthly, null);
    assert.equal(unavailable.taxCalculationStatus, "unavailable");
    assert.equal(unavailable.calculationUnavailableReason, "tax");
  }
  assert.ok(amsterdam.dataSources.some((item) => /Life Atlas保存参考値/.test(item.source)));
  assert.ok(amsterdam.dataSources.some((item) => item.url.includes("tabel-arbeidskorting-2026")));
});

test("Korea 2026 payroll applies the earned-income deduction, basic deduction, premiums, tax credit and 10% local income tax", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 勤労所得控除の各区間と上限2,000万ウォン
  close(koreaEarnedIncomeDeduction2026(5_000_000), 3_500_000);
  close(koreaEarnedIncomeDeduction2026(20_000_000), 8_250_000);
  close(koreaEarnedIncomeDeduction2026(55_000_000), 12_500_000);
  close(koreaEarnedIncomeDeduction2026(100_000_000), 14_750_000);
  assert.equal(koreaEarnedIncomeDeduction2026(1_000_000_000), 20_000_000);
  // 勤労所得税額控除：130万以下は55%、上限は総給与で74万→66万→50万→20万
  close(koreaEarnedIncomeTaxCredit2026(1_000_000, 30_000_000), 550_000);
  close(koreaEarnedIncomeTaxCredit2026(4_000_000, 30_000_000), 740_000);
  close(koreaEarnedIncomeTaxCredit2026(4_000_000, 55_000_000), 660_000);
  close(koreaEarnedIncomeTaxCredit2026(10_000_000, 100_000_000), 500_000);
  close(koreaEarnedIncomeTaxCredit2026(30_000_000, 200_000_000), 200_000);
  // 5,500万ウォン：年金 55,000,000×4.75%＝2,612,500、健康 1,977,250＋長期療養 275,000×0.9448＝259,820、雇用 495,000。
  // 課税標準 42,500,000−1,500,000−2,612,500−2,237,070−495,000＝35,655,430 → 算出税額 840,000＋21,655,430×15%＝4,088,314.5、
  // 税額控除は上限66万 → 所得税 3,428,314.5、地方所得税 342,831.45
  const middle = calculateKoreaPayroll(55_000_000);
  close(middle.pension, 2_612_500);
  close(middle.health, 2_237_070);
  close(middle.employment, 495_000);
  close(middle.incomeTax, 3_428_314.5);
  close(middle.localIncomeTax, 342_831.45);
  // 1億ウォン：年金は基準所得月額の上限（1〜6月637万、7〜12月659万）、24%帯、税額控除は最低50万
  const high = calculateKoreaPayroll(100_000_000);
  close(high.pension, (6_370_000 + 6_590_000) * 6 * 0.0475);
  close(high.incomeTax, 6_240_000 + (75_089_000 - 50_000_000) * 0.24 - 500_000);
  // 2,000万ウォン：保険料の特別所得控除（8,306,520×6%×45%＝224,276.04）より、
  // 標準税額控除13万（9,300,000×6%×45%−130,000＝121,100）の方が小さいため後者を採用
  close(calculateKoreaPayroll(20_000_000).incomeTax, 121_100);
  assert.deepEqual(calculateKoreaPayroll(0), { incomeTax: 0, localIncomeTax: 0, pension: 0, health: 0, employment: 0 });

  const seoul = cities.seoul;
  assert.equal(taxCalculationStatus(seoul), "official-rate-estimate");
  const result = calculateCity(seoul, 55_000_000, "single", "onebed", "balanced", "under40");
  close(result.taxMonthly ?? Number.NaN, (3_428_314.5 + 342_831.45 + 2_612_500 + 2_237_070 + 495_000) / 12);
  assert.equal(result.calculationUnavailableReason, null);
  assert.ok(seoul.dataSources.some((item) => /Life Atlas保存参考値/.test(item.source)));
  assert.ok(seoul.dataSources.some((item) => item.url.startsWith("https://www.law.go.kr/")));
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
  // $100,000：CPPの上乗せ分 4,230.45×1/5.95＝711.0 と CPP2 416 を所得控除 → 課税所得98,873。
  // 連邦：累進税額 − 14%×(基礎控除16,452＋雇用控除1,501＋CPP基本部分3,519.45＋EI 1,123.07)＝13,301.5972
  // 州：累進税額 − 8%×(22,769＋3,519.45＋1,123.07)＝6,470.3784（補足控除は0）
  close(incomeTax(100_000), 13_301.5972 + 6_470.3784);
  // $300,000：連邦の基礎控除は最低額$14,829に下がる
  close(incomeTax(300_000), 69_667.9872 + 31_020.8784);
  // $20,000：連邦は控除後わずか、州は基礎控除の範囲内で0
  close(incomeTax(20_000), 103.495);
  assert.equal(taxCalculationStatus(cities.calgary), "official-rate-estimate");
});

test("Quebec 2026 applies the federal abatement, Quebec brackets, QPP, Quebec EI and QPIP", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const breakdown = calculateCity(cities.montreal, 100_000, "single", "onebed", "balanced", "under40").taxBreakdown;
  // 課税所得 100,000−QPP上乗せ分(4,479.3×1/6.3)−QPP2 416＝98,873。連邦基本税13,234.89（基礎控除・雇用控除・QPP基本部分・
  // EI・QPIPを14%で控除）×(1−16.5%)＋州税（累進税額−18,952×14%＝13,415.34）
  close((breakdown?.incomeTaxMonthly ?? 0) * 12, 13_234.89 * 0.835 + 13_415.34);
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

test("Taiwan 2026 applies the 115 tax brackets, labor insurance and NHI caps", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 年NT$1,200,000：課税所得736,000 → 30,500＋126,000×12%。労保は上限45,800×2.5%、健保は月100,000×1.551%
  const middle = calculateTaiwanPayroll(1_200_000);
  close(middle.incomeTax, 45_620);
  close(middle.laborInsurance, 1_145 * 12);
  close(middle.healthInsurance, 1_551 * 12);
  // 年NT$6,000,000：課税所得5,536,000 → 1,126,900＋346,000×40%。健保は上限313,000
  const high = calculateTaiwanPayroll(6_000_000);
  close(high.incomeTax, 1_265_300);
  close(high.healthInsurance, 313_000 * 0.0517 * 0.3 * 12);
  // 年NT$400,000：控除合計464,000以下なので所得税0
  const low = calculateTaiwanPayroll(400_000);
  assert.equal(low.incomeTax, 0);
  close(low.laborInsurance, 10_000);
  assert.equal(taxCalculationStatus(cities.taipei), "official-rate-estimate");
});

test("Indonesia 2026 adds employer BPJS premiums to gross and applies the UU HPP brackets", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 月Rp20,000,000：JHT 400,000、JP 1%（1〜2月10,547,400・3〜12月11,086,300が上限）、JKN上限12,000,000
  const middle = calculateIndonesiaPayroll(240_000_000);
  close(middle.pension, 4_800_000 + 105_474 * 2 + 110_863 * 10);
  close(middle.health, 120_000 * 12);
  // 総額240M＋会社負担（JKK48,000・JKM60,000・JKN480,000）×12＝247,056,000。職務費用6M、JHT・JP控除後にPTKP54M → 180,936,000
  close(middle.incomeTax, 60_000_000 * 0.05 + 120_936_000 * 0.15);
  // 月Rp5,000,000：課税所得3,787,000×5%
  close(calculateIndonesiaPayroll(60_000_000).incomeTax, 189_350);
  assert.equal(taxCalculationStatus(cities.jakarta), "official-rate-estimate");
});

test("India new regime applies the standard deduction, the 87A rebate, surcharge relief and 4% cess", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 課税所得₹12 lakh以下（給与₹12.75 lakhまで）は87条Aで0
  assert.equal(calculateIndiaIncomeTax(1_275_000), 0);
  // 給与₹13 lakh → 課税₹12.25 lakh。税率表では₹63,750だが、₹12 lakh超過分₹25,000までに抑える
  close(calculateIndiaIncomeTax(1_300_000), 25_000 * 1.04);
  // 給与₹20 lakh → 課税₹19.25 lakh：20,000+40,000+60,000+325,000×20%
  close(calculateIndiaIncomeTax(2_000_000), 185_000 * 1.04);
  // 課税₹51.25 lakh：付加税10%は₹50 lakh超過分₹125,000までに抑える
  close(calculateIndiaIncomeTax(5_200_000), (1_080_000 + 125_000) * 1.04);
  assert.equal(taxCalculationStatus(cities.bangalore), "official-rate-estimate");
});

test("Riyadh and Abu Dhabi deduct no income tax or employee social insurance for foreign employees", () => {
  for (const cityId of ["riyadh", "abuDhabi"] as const) {
    assert.equal(taxCalculationStatus(cities[cityId]), "official-scenario");
    const result = calculateCity(cities[cityId], 200_000, "single", "onebed", "balanced", "under40");
    assert.equal(result.taxBreakdown?.totalDeductionsMonthly, 0);
  }
});

test("Malaysia 2026 applies the LHDN MTD table with the RM400 rebate and the foreign-employee EPF", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 年RM84,000：EPF 1,680、課税所得84,000−9,000−1,680＝73,320 → (73,320−70,000)×19%＋3,700
  const middle = calculateMalaysiaPayroll(84_000);
  close(middle.epf, 1_680);
  close(middle.incomeTax, 3_320 * 0.19 + 3_700);
  // 年RM30,000：課税所得20,400 → 400×3%−250 は負になるため0（RM400の税額控除）
  assert.equal(calculateMalaysiaPayroll(30_000).incomeTax, 0);
  // 年RM600,000：EPF控除は上限RM4,000、課税所得587,000 → 187,000×26%＋84,400
  close(calculateMalaysiaPayroll(600_000).incomeTax, 187_000 * 0.26 + 84_400);
  assert.equal(taxCalculationStatus(cities.kualaLumpur), "official-rate-estimate");
});

test("Portugal 2026 applies the CIRS brackets, the specific deduction, the minimum-existence rule and the €250 credit", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // €28,000：社会保険3,080、給与所得控除IAS×8.54＝4,587.0902、課税所得23,412.9098
  const middle = calculatePortugalPayroll(28_000);
  close(middle.socialSecurity, 3_080);
  close(middle.incomeTax, 8_342 * 0.125 + 4_245 * 0.157 + 5_251 * 0.212 + 5_251 * 0.241 + (28_000 - 537.13 * 8.54 - 23_089) * 0.311 - 250);
  // €12,880（参照額）：最低生活保障で課税所得は€2,000になり、€250の税額控除で0
  close(calculatePortugalPayroll(12_880).incomeTax, 0);
  // €14,000：参照額〜Lの区間。控除額＝12,880−2.6×1,120−(4,587.0902＋2,000)、課税所得6,032
  close(calculatePortugalPayroll(14_000).incomeTax, 6_032 * 0.125 - 250);
  // €120,000：課税所得106,800。€86,634までの税額30,197.047に48%、€80,000超の連帯付加税2.5%
  close(calculatePortugalPayroll(120_000).incomeTax, 30_197.047 + 20_166 * 0.48 - 250 + 26_800 * 0.025);
  assert.equal(taxCalculationStatus(cities.lisbon), "official-rate-estimate");
});

test("Madrid 2026 applies the state and Madrid scales, the work reduction and the low-earner credit", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // €34,000：社会保険6.5%＝2,210、課税所得29,790
  const middle = calculateSpainMadridPayroll(34_000);
  close(middle.socialSecurity, 2_210);
  close(middle.stateTax, 1_182.75 + 7_750 * 0.12 + 9_590 * 0.15 - 5_550 * 0.095);
  close(middle.regionalTax, 13_362.22 * 0.085 + 5_642.41 * 0.107 + (29_790 - 19_004.63) * 0.128 - 5_956.65 * 0.085);
  // €18,000：勤労所得減額7,302−1.75×1,978、課税所得10,989.5。国の税額516.75から税額控除590.89−0.2×906を差し引く
  const low = calculateSpainMadridPayroll(18_000);
  close(low.stateTax, (10_989.5 - 5_550) * 0.095 - (590.89 - 0.2 * 906));
  close(low.regionalTax, (10_989.5 - 5_956.65) * 0.085);
  // €100,000：上限€5,101.20超の部分に連帯追加保険料（本人負担4.70/28.30）
  const excess = 100_000 / 12 - 5_101.2;
  close(calculateSpainMadridPayroll(100_000).socialSecurity, (5_101.2 * 0.065 + 510.12 * 0.0019 + 2_040.48 * 0.0021 + (excess - 2_550.6) * 0.0024) * 12);
  assert.equal(taxCalculationStatus(cities.madrid), "official-rate-estimate");
});

test("Colombia 2026 applies Law 100 contributions, the 25% exemption capped at 790 UVT and the article 241 table", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1, `${actual} != ${expected}`);
  // 月$10,000,000（最低賃金の5.7倍）：年金4%＋連帯基金1%、医療4%。課税所得81,900,000＝1,563.75 UVT
  const middle = calculateColombiaPayroll(120_000_000);
  close(middle.pension, 6_000_000);
  close(middle.health, 4_800_000);
  close(middle.incomeTax, (81_900_000 / 52_374 - 1_090) * 0.19 * 52_374);
  // 月$50,000,000：基礎は最低賃金25倍が上限、連帯基金2%。25%非課税は790 UVTまで
  const high = calculateColombiaPayroll(600_000_000);
  const base = 25 * 1_750_905;
  close(high.pension, base * 0.06 * 12);
  const taxable = 600_000_000 - base * 0.1 * 12 - 790 * 52_374;
  close(high.incomeTax, ((taxable / 52_374 - 8_670) * 0.35 + 2_296) * 52_374);
  assert.equal(calculateColombiaPayroll(60_000_000).incomeTax, 0);
  assert.equal(taxCalculationStatus(cities.bogota), "official-rate-estimate");
});

test("Chile applies the September 2026 SII monthly table with AFP Uno, FONASA and unemployment contributions capped in UF", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 月$2,000,000：年金10%＋手数料0.46%＝209,200、医療7%＝140,000、失業0.6%＝12,000。課税1,638,800は4%の段（控除額38,729.34）
  const middle = calculateChilePayroll(24_000_000);
  close(middle.pension, 209_200 * 12);
  close(middle.health, 140_000 * 12);
  close(middle.unemployment, 12_000 * 12);
  close(middle.incomeTax, (1_638_800 * 0.04 - 38_729.34) * 12);
  // 月$10,000,000：年金・医療は90 UF（×41,057.20＝3,695,148）、失業は135.2 UF（5,550,933.44）が上限。課税9,321,521.56は35%の段
  const high = calculateChilePayroll(120_000_000);
  close(high.pension, 3_695_148 * 0.1046 * 12);
  close(high.health, 3_695_148 * 0.07 * 12);
  close(high.unemployment, 5_550_933.44 * 0.006 * 12);
  const taxable = 10_000_000 - 3_695_148 * 0.1746 - 5_550_933.44 * 0.006;
  close(high.incomeTax, (taxable * 0.35 - 1_672_533.72) * 12);
  // 課税所得が13.5 UTM（$968,233.50）以下なら非課税
  assert.equal(calculateChilePayroll(10_000_000).incomeTax, 0);
  assert.equal(taxCalculationStatus(cities.santiago), "official-rate-estimate");
});

test("Argentina 2026 uses ARCA's annual tables and stays unavailable above the lowest published contribution cap", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 年$49,000,000（月給3,769,231）：拠出17%、控除(6,019,671.36＋28,894,422.56)×13/12
  const payroll = calculateArgentinaPayroll(49_000_000);
  assert.ok(payroll);
  close(payroll.pension + payroll.health, 49_000_000 * 0.17);
  const taxable = 49_000_000 * 0.83 - (6_019_671.36 + 28_894_422.56) * 13 / 12;
  close(payroll.incomeTax, 108_424.59 + (taxable - 2_168_491.89) * 0.09);
  assert.equal(calculateArgentinaPayroll(12_000_000)?.incomeTax, 0);
  // 月給が1月の上限$3,823,372.95を超えると、未公表の11・12月の上限に左右されるため計算不能
  assert.equal(calculateArgentinaPayroll(50_000_000), null);
  const result = calculateCity(cities.buenosAires, 50_000_000, "single", "onebed", "balanced", "under40");
  assert.equal(result.taxCalculationStatus, "unavailable");
  assert.equal(result.netMonthly, null);
  assert.equal(taxCalculationStatus(cities.buenosAires), "official-rate-estimate");
});

test("Edinburgh uses the 2026-27 Scottish income tax bands with UK National Insurance", () => {
  const result = calculateCity(cities.edinburgh, 50_000, "single", "onebed", "balanced", "under40");
  // 課税所得37,430：3,967×19%＋12,989×20%＋14,136×21%＋6,338×42%
  const expectedTax = 3_967 * 0.19 + 12_989 * 0.2 + 14_136 * 0.21 + 6_338 * 0.42;
  assert.ok(Math.abs((result.taxBreakdown?.incomeTaxMonthly ?? 0) * 12 - expectedTax) < 0.01);
  const london = calculateCity(cities.london, 50_000, "single", "onebed", "balanced", "under40");
  assert.equal(result.taxBreakdown?.employmentInsuranceMonthly, london.taxBreakdown?.employmentInsuranceMonthly);
  assert.equal(taxCalculationStatus(cities.edinburgh), "official-rate-estimate");
});

test("Milan applies the Lombardy progressive surcharge and Milan's 0.8% municipal surcharge above €23,000", () => {
  const result = calculateCity(cities.milan, 42_000, "single", "onebed", "balanced", "under40");
  const taxable = 42_000 - 42_000 * 0.0919;
  const expectedLocal = 15_000 * 0.0123 + 13_000 * 0.0158 + (taxable - 28_000) * 0.0172 + taxable * 0.008;
  assert.ok(Math.abs((result.taxBreakdown?.residentTaxMonthly ?? 0) * 12 - expectedLocal) < 0.01);
  // 課税所得€23,000以下は市税が免除され、州税だけになる
  const low = calculateCity(cities.milan, 25_000, "single", "onebed", "balanced", "under40");
  const lowTaxable = 25_000 - 25_000 * 0.0919;
  assert.ok(Math.abs((low.taxBreakdown?.residentTaxMonthly ?? 0) * 12 - (15_000 * 0.0123 + (lowTaxable - 15_000) * 0.0158)) < 0.01);
});

test("Italy 2026 IRPEF uses 23% to €28,000, 33% to €50,000 and 43% above", () => {
  const result = calculateCity(cities.rome, 60_000, "single", "onebed", "balanced", "under40");
  const pension = 60_000 * 0.0919 + (60_000 - 56_224) * 0.01;
  const taxable = 60_000 - pension;
  const expected = 28_000 * 0.23 + 22_000 * 0.33 + (taxable - 50_000) * 0.43;
  assert.ok(Math.abs((result.taxBreakdown?.incomeTaxMonthly ?? 0) * 12 - expected) < 0.01);
});

test("Japanese cities use the FY2026 Kyokai Kenpo health insurance rate of their prefecture", () => {
  const expected = { tokyo: 0.0985, osaka: 0.1013, sapporo: 0.1028, fukuoka: 0.1011, yokohama: 0.0992, nagoya: 0.0993, kyoto: 0.0989 } as const;
  for (const [cityId, rate] of Object.entries(expected) as Array<[keyof typeof expected, number]>) {
    assert.ok(Math.abs(cities[cityId].insurance.healthRateEmployee - rate / 2) < 1e-9, cityId);
    const result = calculateCity(cities[cityId], 6_000_000, "single", "onebed", "balanced", "under40");
    assert.ok(Math.abs((result.taxBreakdown?.healthInsuranceMonthly ?? 0) * 12 - 6_000_000 * rate / 2) < 0.01, cityId);
  }
});

test("Zurich 2026 combines the federal table, the cantonal base table with canton and city multipliers, and official average NBU/BVG rates", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 直接連邦税（ESTV Form. 58c 2026の表の値と一致。CHF 100未満切り捨て、CHF 25未満は0、CHF 793,900超は一律11.5%）
  assert.equal(swissFederalIncomeTax2026(18_499), 0);
  close(swissFederalIncomeTax2026(18_500), 25.41);
  close(swissFederalIncomeTax2026(43_500), 229.2);
  close(swissFederalIncomeTax2026(82_100), 1_502.95);
  close(swissFederalIncomeTax2026(185_100), 10_936.55);
  close(swissFederalIncomeTax2026(400_000), 39_303.35);
  close(swissFederalIncomeTax2026(800_000), 92_000);
  // 州法第35条1項（2026年）：CHF 266,700までの単純税額は24,655
  close(zurichSimpleStateTax2026(266_700), 24_655);
  assert.equal(zurichSimpleStateTax2026(7_000), 0);

  // CHF 105,000：AHV 5,565・ALV 1,155・NBU 1,050・BVG 6,825、手取り賃金90,405、職業経費3%＝2,712.15
  // 連邦の課税所得 81,892.85→81,800：1,152.50＋56×5.94＝1,485.14
  // 州の課税所得 80,192.85：単純税額 4,046＋3,792.85×9%＝4,387.3565 ×(98%＋119%)＋人頭税24＝9,544.5636
  const middle = calculateZurichPayroll(105_000);
  close(middle.netWage, 90_405);
  close(middle.federalTax, 1_485.14);
  close(middle.simpleTax, 4_387.3565);
  close(middle.cantonCityTax, 9_544.5636);
  // CHF 60,000：職業経費は最低CHF 2,000。連邦 43,860→43,800：229.20＋3×2.64＝237.12、州 42,160：1,508.6×2.17＋24
  const lower = calculateZurichPayroll(60_000);
  close(lower.federalTax, 237.12);
  close(lower.cantonCityTax, 3_297.662);
  // CHF 250,000：ALV・NBUは年CHF 148,200が上限、職業経費は最高CHF 4,000
  const high = calculateZurichPayroll(250_000);
  close(high.alv, 1_630.2);
  close(high.nbu, 1_482);
  close(high.federalTaxable, 250_000 - 13_250 - 1_630.2 - 1_482 - 16_250 - 800 - 3_200 - 4_000 - 1_800);
  // CHF 20,000：連邦税は0、州・市は単純税額14.4×2.17＋24
  close(calculateZurichPayroll(20_000).cantonCityTax, 55.248);
  assert.equal(calculateZurichPayroll(20_000).federalTax, 0);

  const zurich = cities.zurich;
  assert.equal(taxCalculationStatus(zurich), "official-rate-estimate");
  const result = calculateCity(zurich, 105_000, "single", "onebed", "balanced", "under40");
  const tax = 1_485.14 + 9_544.5636;
  const insurance = 5_565 + 1_155 + 1_050 + 6_825;
  close(result.taxMonthly ?? Number.NaN, (tax + insurance) / 12);
  close(result.netMonthly ?? Number.NaN, (105_000 - tax - insurance) / 12);
  close(result.taxBreakdown?.pensionMonthly ?? Number.NaN, (5_565 + 6_825) / 12);
  close(result.taxBreakdown?.healthInsuranceMonthly ?? Number.NaN, 1_050 / 12);
  close(result.taxBreakdown?.employmentInsuranceMonthly ?? Number.NaN, 1_155 / 12);
  assert.equal(result.calculationUnavailableReason, null);
  // AHVの基準年齢（65歳）以上は控除や保険の扱いが変わるため、推測せず計算不能にします。
  const senior = calculateCity(zurich, 105_000, "single", "onebed", "balanced", "65plus");
  assert.equal(senior.taxBreakdown, null);
  assert.equal(senior.netMonthly, null);
  assert.equal(senior.taxCalculationStatus, "unavailable");
});

test("Italy 2026 subtracts the employee and additional tax credits, and Rome uses Lazio's 2026 bands and Rome's 0.9% above €14,000", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // TUIR第13条：€15,000以下1,955、€15,000〜28,000は1,910＋1,190×(28,000−R)/13,000、€28,000〜50,000は1,910×(50,000−R)/22,000、
  // €25,000超〜35,000は＋65。法律207/2024第1条6項：€20,000超〜32,000は1,000、€40,000まで逓減。
  close(italyEmployeeTaxCredit2026(10_000), 1_955);
  close(italyEmployeeTaxCredit2026(20_000), 1_910 + 1_190 * 8_000 / 13_000);
  close(italyEmployeeTaxCredit2026(30_000), 1_910 * 20_000 / 22_000 + 65);
  assert.equal(italyEmployeeTaxCredit2026(50_000), 0);
  assert.equal(italyAdditionalCredit2026(20_000), 0);
  close(italyAdditionalCredit2026(32_000), 1_000);
  close(italyAdditionalCredit2026(36_000), 500);
  assert.equal(italyAdditionalCredit2026(40_000), 0);

  // ローマ・年収€35,000：年金3,216.5、課税所得31,783.5、IRPEF総額7,688.555、控除1,646.5325＋1,000 → 5,042.0225
  // ラツィオ州 15,000×1.73%＋16,783.5×3.33%＝818.39055、ローマ市 31,783.5×0.9%＝286.0515
  const rome = calculateItalyPayroll(35_000, "lazio");
  close(rome.pension, 3_216.5);
  close(rome.grossTax, 7_688.555);
  close(rome.nationalTax, 5_042.0225);
  close(rome.localTax, 818.39055 + 286.0515);
  const romeCity = calculateCity(cities.rome, 35_000, "single", "onebed", "balanced", "under40");
  close((romeCity.taxBreakdown?.incomeTaxMonthly ?? 0) * 12, 5_042.0225);
  close((romeCity.taxBreakdown?.residentTaxMonthly ?? 0) * 12, 1_104.44205);
  // 年収€10,000：課税所得9,081はラツィオ州の€28,000以下の一律1.73%、ローマ市は€14,000以下で免除
  close(calculateItalyPayroll(10_000, "lazio").localTax, 9_081 * 0.0173);
  // 年収€8,000：控除がIRPEF総額を上回り税額0、地方付加税もかからない
  const low = calculateItalyPayroll(8_000, "lazio");
  assert.equal(low.nationalTax, 0);
  assert.equal(low.localTax, 0);
  // 年収€150,000：保険料の基礎は€122,295まで（1996年以降の初加入者の上限）
  close(calculateItalyPayroll(150_000, "lazio").pension, 122_295 * 0.0919 + 66_071 * 0.01);
});

test("France 2026 applies official employee contributions, the 10% allowance, the décote and the €61 threshold", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  // 年収€45,000（PASS以下）：老齢保険 3,105＋180、AGIRC-ARRCO 45,000×4.01%＝1,804.5、CSG・CRDSは44,212.5×9.7%
  // 課税所得 (45,000−5,089.5−3,006.45)×0.9＝33,213.645 → 1,977.69＋3,634.645×30%
  const middle = calculateFrancePayroll(45_000);
  close(middle.pension, 5_089.5);
  close(middle.csgCrds, 4_288.6125);
  close(middle.netTaxableSalary, 36_904.05);
  close(middle.taxableIncome, 33_213.645);
  close(middle.incomeTax, 3_068.0835);
  // 年収€100,000：第2区分 51,940×9.72%、CET 100,000×0.14%
  const high = calculateFrancePayroll(100_000);
  close(high.pension, 10_831.914);
  close(high.taxableIncome, 74_238.3774);
  close(high.incomeTax, 15_375.50322);
  // 年収€250,000：CSGの基礎はPASSの4倍（192,240）まで98.25%、超える部分は100%
  close(calculateFrancePayroll(250_000).csgCrds, (192_240 * 0.9825 + 57_760) * 0.097);
  // 年収€25,000：税額753.72275にdécote 897−753.72275×45.25%＝555.9405
  close(calculateFrancePayroll(25_000).incomeTax, 197.78225);
  // 年収€20,000：décoteで税額0
  assert.equal(calculateFrancePayroll(20_000).incomeTax, 0);

  const paris = calculateCity(cities.paris, 45_000, "single", "onebed", "balanced", "under40");
  close((paris.taxBreakdown?.incomeTaxMonthly ?? 0) * 12, 3_068.0835);
  close((paris.taxBreakdown?.pensionMonthly ?? 0) * 12, 5_089.5);
  close((paris.taxBreakdown?.healthInsuranceMonthly ?? 0) * 12, 4_288.6125);
  assert.equal(paris.taxBreakdown?.employmentInsuranceMonthly, 0);
  close(paris.netMonthly ?? Number.NaN, (45_000 - 3_068.0835 - 5_089.5 - 4_288.6125) / 12);
});

test("Canada 2026 takes basic personal, employment, CPP and EI amounts as credits at the lowest rate", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const tax = (cityId: "toronto" | "vancouver", gross: number) => calculateCity(cities[cityId], gross, "single", "onebed", "balanced", "under40").taxBreakdown;
  // トロント$100,000：課税所得98,873、連邦13,301.5972、オンタリオ州（5.05%の税額控除後＋付加税）5,972.748088、健康保険料750
  const toronto = tax("toronto", 100_000);
  close((toronto?.incomeTaxMonthly ?? 0) * 12, 13_301.5972 + 5_972.748088);
  close((toronto?.healthInsuranceMonthly ?? 0) * 12, 750);
  // バンクーバー$30,000：BC州の税額控除（5.60%）後824.222から低所得者の税軽減 690−(29,735−25,570)×3.56%＝541.726
  const vancouver = tax("vancouver", 30_000);
  close((vancouver?.incomeTaxMonthly ?? 0) * 12, 1_397.375 + 282.496);
  // バンクーバー$100,000：税軽減は0
  close((tax("vancouver", 100_000)?.incomeTaxMonthly ?? 0) * 12, 13_301.5972 + 5_555.52088);
});

test("US 2026 adds California SDI, Washington paid leave and WA Cares, and New York paid family leave", () => {
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);
  const statePayroll = (cityId: "losAngeles" | "seattle" | "newYork" | "chicago", gross: number) => (calculateCity(cities[cityId], gross, "single", "onebed", "balanced", "under40").taxBreakdown?.employmentInsuranceMonthly ?? 0) * 12;
  // カリフォルニアSDI 1.3%（上限なし）
  close(statePayroll("losAngeles", 300_000), 3_900);
  // ワシントン：有給休暇 1.13%×71.43%（$184,500まで）＋WA Cares 0.58%（上限なし）
  close(statePayroll("seattle", 100_000), 100_000 * 0.0113 * 0.7143 + 580);
  close(statePayroll("seattle", 300_000), 184_500 * 0.0113 * 0.7143 + 1_740);
  // ニューヨーク有給家族休暇 0.432%（年$411.91まで）
  close(statePayroll("newYork", 50_000), 216);
  close(statePayroll("newYork", 200_000), 411.91);
  // イリノイは州の給与天引きなし
  assert.equal(statePayroll("chicago", 100_000), 0);
});
