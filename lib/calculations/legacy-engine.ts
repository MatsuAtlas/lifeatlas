import type {
  AgeBand,
  CalculationCity as City,
  InsuranceConfig,
  LegacyCityResult,
  TaxCalculationStatus,
  ExpatTaxRegimeStatus,
} from "../../types/finance";

export const householdMultipliers = {
  single: 1,
  couple: 1.55,
  singleParent: 1.42,
  coupleOneChild: 1.8,
  family: 2.05,
  familyThreeChildren: 2.45,
} as const;
export const housingMultipliers = {
  shared: 0.58,
  studio: 0.8,
  onebed: 1,
  condo: 1.15,
  twobed: 1.55,
  house: 2.05,
} as const;
export const lifestyleMultipliers = { lean: 0.8, balanced: 1, comfortable: 1.25 };


const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

type TaxSlice = { limit: number; rate: number };

function progressiveTax(income: number, slices: TaxSlice[]) {
  let previousLimit = 0;
  let total = 0;
  for (const slice of slices) {
    const taxableInSlice = Math.max(0, Math.min(income, slice.limit) - previousLimit);
    total += taxableInSlice * slice.rate;
    previousLimit = slice.limit;
    if (income <= slice.limit) break;
  }
  return total;
}

function japaneseSalaryDeduction(grossAnnual: number) {
  if (grossAnnual <= 740_000) return grossAnnual;
  if (grossAnnual <= 2_190_000) return 740_000;
  if (grossAnnual < 2_193_000) return grossAnnual - 1_451_000;
  if (grossAnnual < 2_196_000) return grossAnnual - 1_453_000;
  if (grossAnnual < 2_200_000) return grossAnnual - 1_456_000;
  if (grossAnnual <= 3_600_000) return grossAnnual * 0.3 + 80_000;
  if (grossAnnual <= 6_600_000) return grossAnnual * 0.2 + 440_000;
  if (grossAnnual <= 8_500_000) return grossAnnual * 0.1 + 1_100_000;
  return 1_950_000;
}

function japaneseBasicDeduction(grossAnnual: number) {
  if (grossAnnual <= 2_060_000) return 1_040_000;
  if (grossAnnual <= 4_751_999) return 620_000;
  if (grossAnnual <= 6_655_556) return 680_000;
  if (grossAnnual <= 8_500_000) return 670_000;
  if (grossAnnual <= 25_450_000) return 620_000;
  return 0;
}

// 日本・家族の人的控除（令和8年分の所得税、国税庁タックスアンサーNo.1171・1180・1191・1195、令和8年4月1日現在）。
// 住民税は横浜市「所得控除（令和8年度課税以降）」の控除額。配偶者の所得要件は所得税が62万円以下、住民税は
// 令和8年度が58万円以下（令和9年度から62万円の予定）ですが、58万円超62万円以下の帯では住民税の配偶者控除と
// 配偶者特別控除が同額（33万・22万・11万円）のため、どちらの要件でも結果は変わりません。
// 子どもは所得がない前提で、年齢は12月31日時点。16歳未満は扶養控除なし、16〜18歳と23歳以上は一般、19〜22歳は特定扶養。
// ひとり親控除は単身＋子どもありの世帯で本人の合計所得500万円以下の場合。老人扶養・調整控除・非課税限度額は未反映。
// 障害者控除（国税庁No.1160：障害者27万・特別障害者40万・同居特別障害者75万円、横浜市：住民税26万・30万・53万円）は、
// Offer Analyzerで本人が入力した対象人数だけを使います。健康に関わる情報のため保存・共有・AIの説明には含めません。
export type JapanDisabilityCounts = { general: number; special: number; cohabitingSpecial: number };
export type JapanFamily = { spouseSalary?: number; childrenAges?: number[]; singleParent?: boolean; disability?: JapanDisabilityCounts };

const japanSpouseSpecialBands = [
  { upTo: 950_000, incomeTax: [380_000, 260_000, 130_000], residentTax: [330_000, 220_000, 110_000] },
  { upTo: 1_000_000, incomeTax: [360_000, 240_000, 120_000], residentTax: [330_000, 220_000, 110_000] },
  { upTo: 1_050_000, incomeTax: [310_000, 210_000, 110_000], residentTax: [310_000, 210_000, 110_000] },
  { upTo: 1_100_000, incomeTax: [260_000, 180_000, 90_000], residentTax: [260_000, 180_000, 90_000] },
  { upTo: 1_150_000, incomeTax: [210_000, 140_000, 70_000], residentTax: [210_000, 140_000, 70_000] },
  { upTo: 1_200_000, incomeTax: [160_000, 110_000, 60_000], residentTax: [160_000, 110_000, 60_000] },
  { upTo: 1_250_000, incomeTax: [110_000, 80_000, 40_000], residentTax: [110_000, 80_000, 40_000] },
  { upTo: 1_300_000, incomeTax: [60_000, 40_000, 20_000], residentTax: [60_000, 40_000, 20_000] },
  { upTo: 1_330_000, incomeTax: [30_000, 20_000, 10_000], residentTax: [30_000, 20_000, 10_000] },
];

export function japanFamilyDeductions(taxpayerTotalIncome: number, family: JapanFamily = {}) {
  let incomeTax = 0;
  let residentTax = 0;
  if (family.spouseSalary !== undefined && taxpayerTotalIncome <= 10_000_000) {
    const spouseSalary = Math.max(0, family.spouseSalary);
    const spouseIncome = Math.max(0, spouseSalary - japaneseSalaryDeduction(spouseSalary));
    const tier = taxpayerTotalIncome <= 9_000_000 ? 0 : taxpayerTotalIncome <= 9_500_000 ? 1 : 2;
    if (spouseIncome <= 620_000) {
      incomeTax += [380_000, 260_000, 130_000][tier];
      residentTax += [330_000, 220_000, 110_000][tier];
    } else {
      const band = japanSpouseSpecialBands.find((item) => spouseIncome <= item.upTo);
      if (band) {
        incomeTax += band.incomeTax[tier];
        residentTax += band.residentTax[tier];
      }
    }
  }
  for (const age of family.childrenAges ?? []) {
    if (age < 16) continue;
    const specific = age >= 19 && age <= 22;
    incomeTax += specific ? 630_000 : 380_000;
    residentTax += specific ? 450_000 : 330_000;
  }
  if (family.singleParent && taxpayerTotalIncome <= 5_000_000) {
    incomeTax += 350_000;
    residentTax += 300_000;
  }
  if (family.disability) {
    const { general, special, cohabitingSpecial } = family.disability;
    incomeTax += general * 270_000 + special * 400_000 + cohabitingSpecial * 750_000;
    residentTax += general * 260_000 + special * 300_000 + cohabitingSpecial * 530_000;
  }
  return { incomeTax, residentTax };
}

function calculateJapanInsurance(city: City, grossAnnual: number, ageBand: AgeBand) {
  const insurance = city.insurance;
  const healthInsurance = grossAnnual * insurance.healthRateEmployee;
  const childSupport = grossAnnual * insurance.childSupportRateEmployee;
  const careInsurance = ageBand === "40to64" ? grossAnnual * insurance.careRateEmployee : 0;
  const pension = grossAnnual * insurance.pensionRateEmployee;
  const employment = grossAnnual * insurance.employmentRateEmployee;
  return { healthInsurance, childSupport, careInsurance, pension, employment };
}

function emptyTaxBreakdown() {
  return {
    incomeTaxMonthly: 0, reconstructionSurtaxMonthly: 0, residentTaxMonthly: 0, medicareLevyMonthly: 0,
    healthInsuranceMonthly: 0, careInsuranceMonthly: 0, childSupportMonthly: 0, pensionMonthly: 0,
    employmentInsuranceMonthly: 0, totalTaxMonthly: 0, totalInsuranceMonthly: 0, totalDeductionsMonthly: 0,
    employerSuperMonthly: 0,
  };
}

function taxFromAnnualBrackets(income: number, brackets: TaxSlice[]) {
  return progressiveTax(Math.max(0, income), brackets);
}

function taxFromFixedTariff(income: number, tariffs: Array<{ lower: number; upper: number; fixed: number; rate: number }>) {
  const target = Math.max(0, income);
  const tariff = tariffs.find((item) => target <= item.upper) ?? tariffs[tariffs.length - 1];
  return tariff.fixed + Math.max(0, target - tariff.lower) * tariff.rate;
}

function calculateCanadaPensionParts(grossAnnual: number, insurance: InsuranceConfig) {
  const rate = insurance.pensionRateEmployee || 0.0595;
  const base = Math.min(Math.max(0, grossAnnual - (insurance.pensionBaseExemption ?? 3_500)) * rate, insurance.pensionAnnualMax ?? 4_230.45);
  const second = Math.min(Math.min(Math.max(0, grossAnnual - (insurance.pensionSecondStart ?? 74_600)), (insurance.pensionSecondCap ?? 85_000) - (insurance.pensionSecondStart ?? 74_600)) * (insurance.pensionSecondRateEmployee ?? 0.04), insurance.pensionSecondAnnualMax ?? 416);
  // 基本部分（CPP 4.95%／5.95%、QPP 5.3%／6.3%）は税額控除、上乗せ部分（1%）と第2段階（CPP2・QPP2）は所得控除。
  const creditablePart = base * ((rate - 0.01) / rate);
  return { base, second, creditablePart, deductiblePart: base - creditablePart + second };
}

function calculateCanadaPension(grossAnnual: number, insurance: InsuranceConfig) {
  const parts = calculateCanadaPensionParts(grossAnnual, insurance);
  return parts.base + parts.second;
}

function calculateOntarioHealthPremium(taxableIncome: number) {
  if (taxableIncome <= 20_000) return 0;
  if (taxableIncome <= 36_000) return Math.min(300, (taxableIncome - 20_000) * 0.06);
  if (taxableIncome <= 48_000) return Math.min(450, 300 + (taxableIncome - 36_000) * 0.06);
  if (taxableIncome <= 72_000) return Math.min(600, 450 + (taxableIncome - 48_000) * 0.25);
  if (taxableIncome <= 200_000) return Math.min(750, 600 + (taxableIncome - 72_000) * 0.25);
  return Math.min(900, 750 + (taxableIncome - 200_000) * 0.25);
}

// カナダ・2026年（単身の給与所得者）。CRAの給与計算式（T4127、2026年1月版）と州政府の資料に従い、基礎控除・雇用控除・
// CPP/QPPの基本部分・EI（ケベックはQPIPも）は「最低税率×金額」の税額控除として差し引きます（所得から差し引くと高所得ほど
// 税が過少になるため）。CPP/QPPの上乗せ部分と第2段階は所得控除。
// 連邦：最低税率14%、基礎控除$16,452（純所得$181,440超で逓減し$258,482以上は$14,829）、雇用控除$1,501。
export const CANADA_FEDERAL_LOWEST_RATE_2026 = 0.14;

export function canadaFederalBasicPersonalAmount2026(netIncome: number) {
  if (netIncome <= 181_440) return 16_452;
  if (netIncome >= 258_482) return 14_829;
  return 16_452 - (netIncome - 181_440) * (16_452 - 14_829) / (258_482 - 181_440);
}

function calculateCanadaTax(city: City, grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const pension = calculateCanadaPensionParts(gross, city.insurance);
  const ei = Math.min(gross * city.insurance.employmentRateEmployee, city.insurance.employmentCap ?? 1_123.07);
  const parentalInsurance = city.taxRegion === "quebec" ? Math.min(gross, 103_000) * 0.00455 : 0;
  const taxable = Math.max(0, gross - pension.deductiblePart);
  const contributionCredits = pension.creditablePart + ei + parentalInsurance;
  const federalCredits = canadaFederalBasicPersonalAmount2026(taxable) + Math.min(1_501, gross) + contributionCredits;
  const federalTax = Math.max(0, taxFromAnnualBrackets(taxable, [
    { limit: 58_523, rate: 0.14 }, { limit: 117_045, rate: 0.205 }, { limit: 181_440, rate: 0.26 }, { limit: 258_482, rate: 0.29 }, { limit: Number.POSITIVE_INFINITY, rate: 0.33 },
  ]) - federalCredits * CANADA_FEDERAL_LOWEST_RATE_2026);
  if (city.taxRegion === "britishColumbia") {
    // BC州2026（州政府の公式ページ）：最低税率5.60%、基礎控除$13,216、低所得者の税軽減$690（純所得$25,570超で3.56%ずつ減額）。
    const beforeReduction = Math.max(0, taxFromAnnualBrackets(taxable, [
      { limit: 50_363, rate: 0.056 }, { limit: 100_728, rate: 0.077 }, { limit: 115_648, rate: 0.105 }, { limit: 140_430, rate: 0.1229 }, { limit: 190_405, rate: 0.147 }, { limit: 265_545, rate: 0.168 }, { limit: Number.POSITIVE_INFINITY, rate: 0.205 },
    ]) - (13_216 + pension.creditablePart + ei) * 0.056);
    const reduction = Math.max(0, 690 - Math.max(0, taxable - 25_570) * 0.0356);
    return { federalTax, provincialTax: Math.max(0, beforeReduction - reduction), healthPremium: 0 };
  }
  if (city.taxRegion === "quebec") {
    // ケベック州2026：連邦税は基本連邦税の16.5%を減額（Québec abatement）。州税は14/19/24/25.75%、
    // 区切り$54,345/$108,680/$132,245、基礎控除$18,952（14%の税額控除）。労働者控除などは未反映。
    const provincialTax = Math.max(0, taxFromAnnualBrackets(taxable, [
      { limit: 54_345, rate: 0.14 }, { limit: 108_680, rate: 0.19 }, { limit: 132_245, rate: 0.24 }, { limit: Number.POSITIVE_INFINITY, rate: 0.2575 },
    ]) - 18_952 * 0.14);
    return { federalTax: federalTax * (1 - 0.165), provincialTax, healthPremium: 0 };
  }
  if (city.taxRegion === "alberta") {
    // 2026年：2025年の公式区切りをCRA公表の指数2.0%で調整（基礎控除$22,769は公式値と一致）。
    // 税額控除は最低税率8%で計算し、控除額の8%が$4,896を超える分の25%を補足控除（T4127のK5P）として加えます。
    const albertaCredits = (22_769 + pension.creditablePart + ei) * 0.08;
    const supplemental = Math.max(0, (albertaCredits - 4_896) * 0.25);
    const provincialTax = Math.max(0, taxFromAnnualBrackets(taxable, [
      { limit: 61_200, rate: 0.08 }, { limit: 154_259, rate: 0.1 }, { limit: 185_111, rate: 0.12 }, { limit: 246_813, rate: 0.13 }, { limit: 370_220, rate: 0.14 }, { limit: Number.POSITIVE_INFINITY, rate: 0.15 },
    ]) - albertaCredits - supplemental);
    return { federalTax, provincialTax, healthPremium: 0 };
  }
  // オンタリオ州2026：最低税率5.05%、基礎控除$12,989（税額控除）、基本州税$5,818超に20%・$7,446超に36%の付加税。
  // 低所得者向けのOntario tax reductionは未反映。
  const provincialTaxBeforeSurtax = Math.max(0, taxFromAnnualBrackets(taxable, [
    { limit: 53_891, rate: 0.0505 }, { limit: 107_785, rate: 0.0915 }, { limit: 150_000, rate: 0.1116 }, { limit: 220_000, rate: 0.1216 }, { limit: Number.POSITIVE_INFINITY, rate: 0.1316 },
  ]) - (12_989 + pension.creditablePart + ei) * 0.0505);
  const surtax = provincialTaxBeforeSurtax <= 5_818 ? 0 : (provincialTaxBeforeSurtax <= 7_446 ? (provincialTaxBeforeSurtax - 5_818) * 0.2 : (provincialTaxBeforeSurtax - 5_818) * 0.2 + (provincialTaxBeforeSurtax - 7_446) * 0.36);
  return { federalTax, provincialTax: provincialTaxBeforeSurtax + surtax, healthPremium: calculateOntarioHealthPremium(taxable) };
}

// 米国の州の給与天引き（2026年、州の公式資料）。カリフォルニア：州障害保険SDI 1.3%（上限なし、EDD）。
// ワシントン：有給家族・医療休暇1.13%の本人負担71.43%（社会保障の上限$184,500まで）とWA Cares 0.58%（上限なし。
// 一時的な就労ビザの人などは申請で免除される場合がある）。ニューヨーク：有給家族休暇0.432%（年$411.91まで）。
// ニューヨークの障害保険（週$0.60まで）とマサチューセッツの有給休暇保険は未反映。
export function usStatePayrollDeductions2026(taxRegion: string, grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  if (taxRegion === "california") return gross * 0.013;
  if (taxRegion === "washington") return Math.min(gross, 184_500) * 0.0113 * 0.7143 + gross * 0.0058;
  if (taxRegion === "newYork") return Math.min(gross * 0.00432, 411.91);
  return 0;
}

function calculateUsIncomeTax(city: City, grossAnnual: number) {
  const federalTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 16_100), [
    { limit: 12_400, rate: 0.1 }, { limit: 50_400, rate: 0.12 }, { limit: 105_700, rate: 0.22 }, { limit: 201_775, rate: 0.24 }, { limit: 256_225, rate: 0.32 }, { limit: 640_600, rate: 0.35 }, { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ]);
  if (city.taxRegion === "california") {
    return federalTax + taxFromAnnualBrackets(Math.max(0, grossAnnual - 5_706), [
      { limit: 11_079, rate: 0.01 }, { limit: 26_264, rate: 0.02 }, { limit: 41_452, rate: 0.04 }, { limit: 57_542, rate: 0.06 }, { limit: 72_724, rate: 0.08 }, { limit: 371_479, rate: 0.093 }, { limit: 445_771, rate: 0.103 }, { limit: 742_953, rate: 0.113 }, { limit: Number.POSITIVE_INFINITY, rate: 0.123 },
    ]);
  }
  if (city.taxRegion === "newYork") {
    const taxable = Math.max(0, grossAnnual - 8_000);
    const stateTax = taxFromAnnualBrackets(taxable, [
      { limit: 8_500, rate: 0.039 }, { limit: 11_700, rate: 0.044 }, { limit: 13_900, rate: 0.0515 }, { limit: 80_650, rate: 0.054 }, { limit: 215_400, rate: 0.059 }, { limit: 1_077_550, rate: 0.0685 }, { limit: 5_000_000, rate: 0.0965 }, { limit: 25_000_000, rate: 0.103 }, { limit: Number.POSITIVE_INFINITY, rate: 0.109 },
    ]);
    const cityTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 8_000), [
      { limit: 12_000, rate: 0.03078 }, { limit: 25_000, rate: 0.03762 }, { limit: 50_000, rate: 0.03819 }, { limit: Number.POSITIVE_INFINITY, rate: 0.03876 },
    ]);
    return federalTax + stateTax + cityTax;
  }
  // 2026課税年度・単身。マサチューセッツ：5%（控除$4,400、課税所得$1,107,750超に4%加算）。
  // イリノイ：4.95%（控除$2,925、連邦AGI$250,000超は控除なし）。DC：4%〜10.75%の7段階（標準控除$16,100）。
  if (city.taxRegion === "massachusetts") {
    const taxable = Math.max(0, grossAnnual - 4_400);
    return federalTax + taxable * 0.05 + Math.max(0, taxable - 1_107_750) * 0.04;
  }
  if (city.taxRegion === "illinois") {
    const exemption = grossAnnual > 250_000 ? 0 : 2_925;
    return federalTax + Math.max(0, grossAnnual - exemption) * 0.0495;
  }
  if (city.taxRegion === "districtOfColumbia") {
    return federalTax + taxFromAnnualBrackets(Math.max(0, grossAnnual - 16_100), [
      { limit: 10_000, rate: 0.04 }, { limit: 40_000, rate: 0.06 }, { limit: 60_000, rate: 0.065 }, { limit: 250_000, rate: 0.085 }, { limit: 500_000, rate: 0.0925 }, { limit: 1_000_000, rate: 0.0975 }, { limit: Number.POSITIVE_INFINITY, rate: 0.1075 },
    ]);
  }
  return federalTax;
}

// 夫婦（子どもの有無を問わない）の世帯区分か。配偶者の給与を使う家族の控除で共通に使います。
function isMarriedHousehold(household: keyof typeof householdMultipliers) {
  return household === "couple" || household === "coupleOneChild" || household === "family" || household === "familyThreeChildren";
}

// 香港・薪俸税（2026/27課税年度、2026年5月13日成立の改正後）と従業員MPF強制拠出。
// 基礎控除と子ども控除（世帯区分の人数）を使い、Offer Analyzerで配偶者の給与を0と入れた夫婦だけ既婚者控除（基礎控除の代わり）を使います。
// 配偶者に所得がある場合の合算課税（選択制）は、本人分の税を分けられないため使いません。
const HONG_KONG_BASIC_ALLOWANCE = 145_000;
const HONG_KONG_MARRIED_PERSON_ALLOWANCE = 290_000;
const HONG_KONG_SINGLE_PARENT_ALLOWANCE = 145_000;
const HONG_KONG_CHILD_ALLOWANCE = 140_000;
const HONG_KONG_MPF_RATE = 0.05;
const HONG_KONG_MPF_MIN_MONTHLY_INCOME = 7_100;
const HONG_KONG_MPF_MAX_MONTHLY_INCOME = 30_000;
const HONG_KONG_MPF_DEDUCTION_CAP = 18_000;
const hongKongChildren = { single: 0, couple: 0, singleParent: 1, coupleOneChild: 1, family: 2, familyThreeChildren: 3 } as const;

export function calculateHongKongSalariesTax(grossAnnual: number, household: keyof typeof householdMultipliers, spouseSalary?: number) {
  const married = isMarriedHousehold(household);
  const monthlyIncome = Math.max(0, grossAnnual) / 12;
  const mpf = monthlyIncome < HONG_KONG_MPF_MIN_MONTHLY_INCOME ? 0 : Math.min(monthlyIncome, HONG_KONG_MPF_MAX_MONTHLY_INCOME) * HONG_KONG_MPF_RATE * 12;
  const netIncome = Math.max(0, grossAnnual - Math.min(mpf, HONG_KONG_MPF_DEDUCTION_CAP));
  const allowances = (married && spouseSalary === 0 ? HONG_KONG_MARRIED_PERSON_ALLOWANCE : HONG_KONG_BASIC_ALLOWANCE)
    + (household === "singleParent" ? HONG_KONG_SINGLE_PARENT_ALLOWANCE : 0)
    + hongKongChildren[household] * HONG_KONG_CHILD_ALLOWANCE;
  const progressive = taxFromAnnualBrackets(Math.max(0, netIncome - allowances), [
    { limit: 50_000, rate: 0.02 }, { limit: 100_000, rate: 0.06 }, { limit: 150_000, rate: 0.1 }, { limit: 200_000, rate: 0.14 }, { limit: Number.POSITIVE_INFINITY, rate: 0.17 },
  ]);
  // 標準税率（控除前の純所得に15%、500万HKD超の部分は16%）が上限になります。
  const standard = taxFromAnnualBrackets(netIncome, [{ limit: 5_000_000, rate: 0.15 }, { limit: Number.POSITIVE_INFINITY, rate: 0.16 }]);
  return { salariesTax: Math.min(progressive, standard), mpf };
}

// アイルランド・2026課税年度（単独課税の給与所得者）。所得税20%/40%（標準税率帯€44,000）から
// 基礎控除額（Personal €2,000・Employee €2,000）を差し引き、USCとPRSI Class A1を加えます。
// PRSIは2026年10月1日に4.2%→4.35%へ上がるため、年間では9か月4.2%・3か月4.35%で按分します。
// Offer Analyzerで配偶者の給与を0と入れた夫婦は、片働き夫婦の合算課税（標準税率帯€53,000、既婚者控除€4,000）を使います。
// 一人親は子どもの年齢を入れ、12月31日に18歳以下（年初に18歳未満）の子がいる場合に Single Person Child Carer Credit €1,900と
// 標準税率帯€48,000を使います（Revenue「Tax rates, bands and reliefs」2026年）。配偶者に所得がある場合の合算課税、
// Home Carer控除、家賃控除などは未反映です。
const IRELAND_STANDARD_RATE_BAND = 44_000;
const IRELAND_TAX_CREDITS = 4_000;
export type IrelandFilingStatus = "single" | "marriedOneIncome" | "singleParent";
const irelandBands: Record<IrelandFilingStatus, { band: number; credits: number }> = {
  single: { band: IRELAND_STANDARD_RATE_BAND, credits: IRELAND_TAX_CREDITS },
  marriedOneIncome: { band: 53_000, credits: 4_000 + 2_000 },
  singleParent: { band: 48_000, credits: IRELAND_TAX_CREDITS + 1_900 },
};
const IRELAND_USC_EXEMPTION = 13_000;
const IRELAND_PRSI_RATE = 0.042 * 0.75 + 0.0435 * 0.25;
const IRELAND_PRSI_WEEKLY_THRESHOLD = 352;
const IRELAND_PRSI_MAX_WEEKLY_CREDIT = 12;

export function calculateIrelandPayrollTax(grossAnnual: number, status: IrelandFilingStatus = "single") {
  const gross = Math.max(0, grossAnnual);
  const { band, credits } = irelandBands[status];
  const incomeTax = Math.max(0, taxFromAnnualBrackets(gross, [{ limit: band, rate: 0.2 }, { limit: Number.POSITIVE_INFINITY, rate: 0.4 }]) - credits);
  const usc = gross <= IRELAND_USC_EXEMPTION ? 0 : taxFromAnnualBrackets(gross, [
    { limit: 12_012, rate: 0.005 }, { limit: 28_700, rate: 0.02 }, { limit: 70_044, rate: 0.03 }, { limit: Number.POSITIVE_INFINITY, rate: 0.08 },
  ]);
  const weekly = gross / 52;
  // 週€352以下はPRSIなし。€352.01〜€424は週€12を上限とするPRSIクレジットが段階的に減ります。
  const weeklyCredit = weekly <= IRELAND_PRSI_WEEKLY_THRESHOLD ? 0 : Math.max(0, IRELAND_PRSI_MAX_WEEKLY_CREDIT - (weekly - IRELAND_PRSI_WEEKLY_THRESHOLD) / 6);
  const prsi = weekly <= IRELAND_PRSI_WEEKLY_THRESHOLD ? 0 : Math.max(0, weekly * IRELAND_PRSI_RATE - weeklyCredit) * 52;
  return { incomeTax, usc, prsi };
}

// ドイツ・2026年（単身の基本税率表、教会税なし）。社会保険料（従業員負担）：年金9.3%・失業1.3%（上限€101,400）、
// 医療7.3%＋平均追加保険料の半分1.45%（上限€69,750）、介護1.8%（子どもなし＋0.6%、2人目以降の子1人につき−0.25%）。
// 課税所得＝給与−被用者控除€1,230−特別支出控除€36−社会保険料控除（年金全額・医療の96%・介護）。
const GERMANY_PENSION_CEILING = 101_400;
const GERMANY_HEALTH_CEILING = 69_750;
const germanyChildren = { single: 0, couple: 0, singleParent: 1, coupleOneChild: 1, family: 2, familyThreeChildren: 3 } as const;

export function germanIncomeTax2026(taxableIncome: number) {
  const x = Math.floor(Math.max(0, taxableIncome));
  if (x <= 12_348) return 0;
  if (x <= 17_799) {
    const y = (x - 12_348) / 10_000;
    return Math.floor((914.51 * y + 1_400) * y);
  }
  if (x <= 69_878) {
    const z = (x - 17_799) / 10_000;
    return Math.floor((173.10 * z + 2_397) * z + 1_034.87);
  }
  if (x <= 277_825) return Math.floor(0.42 * x - 11_135.63);
  return Math.floor(0.45 * x - 19_470.38);
}

export function calculateGermanyPayroll(grossAnnual: number, household: keyof typeof householdMultipliers) {
  const gross = Math.max(0, grossAnnual);
  const pensionBase = Math.min(gross, GERMANY_PENSION_CEILING);
  const healthBase = Math.min(gross, GERMANY_HEALTH_CEILING);
  const children = germanyChildren[household];
  const careRate = children === 0 ? 0.024 : 0.018 - Math.max(0, children - 1) * 0.0025;
  const pension = pensionBase * 0.093;
  const unemployment = pensionBase * 0.013;
  const health = healthBase * (0.073 + 0.0145);
  const care = healthBase * careRate;
  const taxable = gross - 1_230 - 36 - (pension + health * 0.96 + care);
  const incomeTax = germanIncomeTax2026(taxable);
  // 連帯付加税：所得税€20,350以下は免除、超過分は差額の11.9%を上限に5.5%。
  const solidarity = incomeTax <= 20_350 ? 0 : Math.min(incomeTax * 0.055, (incomeTax - 20_350) * 0.119);
  return { incomeTax, solidarity, pension, unemployment, health, care };
}

// オランダ・2026年（AOW年齢未満の居住者、給与所得者）。Box 1は€38,883まで35.75%（所得税8.10%＋国民保険27.65%）、
// €78,426まで37.56%、それを超える部分は49.50%。ここから一般税額控除（最大€3,115、€29,736超で超過分の6.398%ずつ減り
// €78,426以上で0）と労働税額控除（Tabel arbeidskorting 2026の5区間）を差し引きます。
// 30%ルール（外国人専門職の非課税手当）と年金基金の掛金は未反映。基礎医療保険の定額保険料は生活費側で扱います。
export function netherlandsLabourCredit2026(labourIncome: number) {
  const x = Math.max(0, labourIncome);
  if (x <= 11_965) return x * 0.08324;
  if (x <= 25_845) return 996 + (x - 11_965) * 0.31009;
  if (x <= 45_592) return 5_300 + (x - 25_845) * 0.0195;
  if (x <= 132_920) return Math.max(0, 5_685 - (x - 45_592) * 0.0651);
  return 0;
}

export function calculateNetherlandsPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const box1 = taxFromAnnualBrackets(gross, [
    { limit: 38_883, rate: 0.3575 }, { limit: 78_426, rate: 0.3756 }, { limit: Number.POSITIVE_INFINITY, rate: 0.495 },
  ]);
  const generalCredit = gross >= 78_426 ? 0 : Math.max(0, 3_115 - Math.max(0, gross - 29_736) * 0.06398);
  const labourCredit = netherlandsLabourCredit2026(gross);
  // 税額控除はBox 1の税額（所得税＋国民保険料）を超えて還付されません。
  const box1AfterCredits = Math.max(0, box1 - generalCredit - labourCredit);
  return { box1, generalCredit, labourCredit, box1AfterCredits };
}

// スイス・チューリッヒ市・2026年（単身・子どもなし・教会税なし・AHVの基準年齢65歳未満の給与所得者）。
// 本人負担はAHV/IV/EO 5.3%、失業保険ALV 1.1%（年CHF 148,200まで）。業務外の労災保険（NBU）と企業年金（BVG）は
// 勤務先ごとに料率が違うため、連邦税務当局（ESTV）とチューリッヒ州が2026年の源泉税の計算に使う連邦統計局の平均値
// （NBU 1.0%・年CHF 148,200まで、BVG 6.5%）を使います。所得控除は同じ源泉税の標準的な想定（通勤費・昼食費・
// 職業経費3%〈CHF 2,000〜4,000〉・保険料控除）で、国の直接連邦税（DBG第36条1項の2026年単身税率表）と、
// 州法第35条1項の基本税率表（2026年1月1日施行）の単純税額×（州98%＋チューリッヒ市119%）、人頭税CHF 24を計算します。
// 基礎医療保険（KVG）の保険料は人により違い、生活費の医療費側で扱います。州税の端数処理は未反映。
export const SWITZERLAND_AHV_IV_EO_RATE_2026 = 0.053;
export const SWITZERLAND_ALV_RATE_2026 = 0.011;
export const SWITZERLAND_ALV_CEILING_2026 = 148_200;
export const SWITZERLAND_NBU_AVERAGE_RATE_2026 = 0.01;
export const SWITZERLAND_BVG_AVERAGE_RATE_2026 = 0.065;
export const ZURICH_CANTON_MULTIPLIER_2026 = 0.98;
export const ZURICH_CITY_MULTIPLIER_2026 = 1.19;

// DBG第36条1項（2026年）の各区間の起点の税額と、そこからCHF 100ごとの税額。
const swissFederalSingleTariff2026: { from: number; base: number; per100: number }[] = [
  { from: 15_200, base: 0, per100: 0.77 }, { from: 33_200, base: 138.6, per100: 0.88 }, { from: 43_500, base: 229.2, per100: 2.64 },
  { from: 58_000, base: 612, per100: 2.97 }, { from: 76_200, base: 1_152.5, per100: 5.94 }, { from: 82_100, base: 1_502.95, per100: 6.6 },
  { from: 108_900, base: 3_271.75, per100: 8.8 }, { from: 141_500, base: 6_140.55, per100: 11 }, { from: 185_100, base: 10_936.55, per100: 13.2 },
];

export function swissFederalIncomeTax2026(taxableIncome: number) {
  // ESTVの2026年表：CHF 100未満の端数は切り捨て、税額がCHF 25未満なら課税されません（表はCHF 18,500・25.41から）。
  const x = Math.floor(Math.max(0, taxableIncome) / 100) * 100;
  // CHF 793,900を超えると課税所得全体の11.5%で頭打ちになります。
  if (x > 793_900) return x * 0.115;
  const step = [...swissFederalSingleTariff2026].reverse().find((item) => x >= item.from);
  const tax = step ? step.base + ((x - step.from) / 100) * step.per100 : 0;
  return tax < 25 ? 0 : tax;
}

export function zurichSimpleStateTax2026(taxableIncome: number) {
  return taxFromAnnualBrackets(Math.max(0, taxableIncome), [
    { limit: 7_000, rate: 0 }, { limit: 12_000, rate: 0.02 }, { limit: 16_800, rate: 0.03 }, { limit: 24_800, rate: 0.04 },
    { limit: 34_500, rate: 0.05 }, { limit: 45_700, rate: 0.06 }, { limit: 58_800, rate: 0.07 }, { limit: 76_400, rate: 0.08 },
    { limit: 110_400, rate: 0.09 }, { limit: 144_100, rate: 0.1 }, { limit: 197_400, rate: 0.11 }, { limit: 266_700, rate: 0.12 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.13 },
  ]);
}

export function calculateZurichPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const capped = Math.min(gross, SWITZERLAND_ALV_CEILING_2026);
  const ahv = gross * SWITZERLAND_AHV_IV_EO_RATE_2026;
  const alv = capped * SWITZERLAND_ALV_RATE_2026;
  const nbu = capped * SWITZERLAND_NBU_AVERAGE_RATE_2026;
  const bvg = gross * SWITZERLAND_BVG_AVERAGE_RATE_2026;
  const netWage = gross - ahv - alv - nbu - bvg;
  const professionalFlat = Math.min(4_000, Math.max(2_000, netWage * 0.03));
  // 連邦：通勤費CHF 800・昼食費CHF 3,200・職業経費・保険料控除CHF 1,800（BVG加入の単身者の上限）。
  const federalTaxable = Math.max(0, netWage - 800 - 3_200 - professionalFlat - 1_800);
  // 州：通勤費CHF 1,400・昼食費CHF 3,200・職業経費・保険料控除CHF 2,900（州法第31条1項g）。
  const cantonalTaxable = Math.max(0, netWage - 1_400 - 3_200 - professionalFlat - 2_900);
  const federalTax = swissFederalIncomeTax2026(federalTaxable);
  const simpleTax = zurichSimpleStateTax2026(cantonalTaxable);
  const cantonCityTax = simpleTax * (ZURICH_CANTON_MULTIPLIER_2026 + ZURICH_CITY_MULTIPLIER_2026) + 24;
  return { ahv, alv, nbu, bvg, netWage, federalTaxable, cantonalTaxable, federalTax, simpleTax, cantonCityTax };
}

// オランダ・30%ルール（expatregeling、2026年）。条件（国外から採用された「ingekomen werknemer」であること、
// 税務当局の決定）を満たすと本人が選んだ場合だけ使います。非課税手当は手当込みの給与の30%まで、上限€78,600
// （給与€262,000で到達）で、手当を除く課税給与が€48,013を超えている必要があります（Belastingdienst「Inhoud van de
// expatregeling」「Deskundigheidsvereiste」の例：手当込み€70,000→€21,000、€50,000→€1,987）。修士・30歳未満の低い
// 給与基準（€36,497）は学位を入力で判定できないため使いません。手当はBox 1の課税対象（所得税・国民保険料）から外れます。
export const NETHERLANDS_EXPAT_SALARY_NORM_2026 = 48_013;
export const NETHERLANDS_EXPAT_ALLOWANCE_CAP_2026 = 78_600;

export function netherlandsExpatAllowance2026(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  return Math.max(0, Math.min(gross * 0.3, NETHERLANDS_EXPAT_ALLOWANCE_CAP_2026, gross - NETHERLANDS_EXPAT_SALARY_NORM_2026));
}

// 移住者向けの税の特例の適用状況。off＝本人が選んでいない、applied＝適用、notEligible＝都市の特例はあるが
// 給与などの条件を満たさない、notModeled＝この都市の特例は未実装（居住者の通常税制で計算）。
// notBeneficial＝選択制の特例だが、この給与では通常税制のほうが税が少ないため使わない。
export function expatTaxRegimeStatus(city: City, grossAnnual: number | null, requested: boolean, family: KoreaFamily = {}): ExpatTaxRegimeStatus {
  if (!requested) return "off";
  if (city.taxSystem === "netherlands") return grossAnnual !== null && netherlandsExpatAllowance2026(grossAnnual) > 0 ? "applied" : "notEligible";
  if (city.taxSystem === "korea") {
    if (grossAnnual === null || grossAnnual <= 0) return "notEligible";
    return koreaForeignWorkerFlatTax2026(grossAnnual).incomeTax < calculateKoreaPayroll(grossAnnual, family).incomeTax ? "applied" : "notBeneficial";
  }
  if (city.taxSystem === "spain") {
    if (grossAnnual === null || grossAnnual <= 0) return "notEligible";
    const regular = calculateSpainMadridPayroll(grossAnnual);
    return spainImpatriateTax2026(grossAnnual) < regular.stateTax + regular.regionalTax ? "applied" : "notBeneficial";
  }
  if (city.taxSystem === "portugal") {
    if (grossAnnual === null || grossAnnual <= 0) return "notEligible";
    const ifici = portugalIficiTax2026(grossAnnual);
    if (ifici === null) return "unverified";
    return ifici < calculatePortugalPayroll(grossAnnual).incomeTax ? "applied" : "notBeneficial";
  }
  return "notModeled";
}

// ポルトガル・IFICI（科学研究・イノベーションの税優遇、税優遇法第58条のA、法律82/2023）。過去5年ポルトガルの居住者でなく、
// 研究・スタートアップ・認定を受けた高度専門職などの対象業務に就く人は、10年間、給与の純所得（総額−所得税法第25条の控除）に
// 20%の税率を選べます（総合課税も選択可）。純所得€80,000超で連帯付加税（第68条のA）がこの所得にかかるかは公式資料で
// 確認できないため計算せず（null）、一般家計支出の税額控除（€250）も使いません。社会保険は変わりません。
export function portugalIficiTax2026(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  // 純所得は通常税制と同じ第25条の控除（max(IAS×8.54, 社会保険料)）を差し引いた額です。
  const netEmploymentIncome = gross - Math.min(gross, Math.max(PORTUGAL_IAS_2026 * 8.54, calculatePortugalPayroll(gross).socialSecurity));
  return netEmploymentIncome > 80_000 ? null : netEmploymentIncome * 0.2;
}

// スペイン・派遣・移住労働者の特別制度（所得税法第93条、BOE統合版2026年10月2日更新）。過去5年スペインの居住者でなく、
// 雇用契約などでスペインへ移った人は、移った年と続く5年間、非居住者所得税の規則で課税されることを選べます。
// 課税ベースは給与の総額（非居住者所得税法第24条1項：控除・減額なし）で、€600,000までは24%、超える部分は47%。
// 州（マドリード）の税率表は使いません。選択制のため、通常税制より税が少ない場合だけ使います。社会保険は変わりません。
export function spainImpatriateTax2026(grossAnnual: number) {
  return taxFromAnnualBrackets(Math.max(0, grossAnnual), [{ limit: 600_000, rate: 0.24 }, { limit: Number.POSITIVE_INFINITY, rate: 0.47 }]);
}

// 韓国・外国人勤労者の単一税率（租税特例制限法第18条の2、2026年9月18日施行版）。2026年12月31日までに韓国で初めて
// 働き始めた外国人は、20年間、給与（勤労所得）の19%を所得税にでき、その場合は非課税・控除・税額控除を一切使いません。
// 地方所得税は地方税特例制限法第106条の2で同じ税率の10%（給与の1.9%）。本人の申請による選択制のため、通常税制より
// 税が少ない場合だけ使います。社会保険（国民年金・健康保険など）は特例の対象外で、通常どおりかかります。
export const KOREA_FOREIGN_WORKER_FLAT_RATE = 0.19;

export function koreaForeignWorkerFlatTax2026(grossAnnual: number) {
  const incomeTax = Math.max(0, grossAnnual) * KOREA_FOREIGN_WORKER_FLAT_RATE;
  return { incomeTax, localIncomeTax: incomeTax * 0.1 };
}

// タイ・2026課税年度（居住者・単身）。社会保険（第33条）は賃金の5%で、2026年1月から月額上限は賃金฿17,500（最大฿875）。
// 課税所得＝給与−給与所得控除（50%・上限฿100,000）−基礎控除฿60,000−社会保険料−家族の控除。
// 家族の控除（歳入局「ผู้มีเงินได้มีสิทธิหักลดหย่อนอะไรได้บ้าง?」）：所得のない配偶者฿60,000（配偶者の給与を0と入れた場合）、
// 子ども1人฿30,000、2018年以降に生まれた第2子以降は฿60,000。子どもは12月31日に19歳以下（年中ずっと未成年）だけを数え、
// 20〜24歳の就学中の子は入力から判定できないため数えません。第2子以降かは入力した子の年齢順で判定します。
export function thailandFamilyAllowance(family: { spouseSalary?: number; childrenAges?: number[] } = {}) {
  const ages = [...(family.childrenAges ?? [])].sort((a, b) => b - a);
  const children = ages.reduce((total, age, index) => age > 19 ? total : total + (index >= 1 && age <= 8 ? 60_000 : 30_000), 0);
  return (family.spouseSalary === 0 ? 60_000 : 0) + children;
}

export function calculateThailandPayroll(grossAnnual: number, family: { spouseSalary?: number; childrenAges?: number[] } = {}) {
  const gross = Math.max(0, grossAnnual);
  const socialSecurity = Math.min(gross / 12, 17_500) * 0.05 * 12;
  const taxable = Math.max(0, gross - Math.min(gross * 0.5, 100_000) - 60_000 - socialSecurity - thailandFamilyAllowance(family));
  const incomeTax = taxFromAnnualBrackets(taxable, [
    { limit: 150_000, rate: 0 }, { limit: 300_000, rate: 0.05 }, { limit: 500_000, rate: 0.1 }, { limit: 750_000, rate: 0.15 },
    { limit: 1_000_000, rate: 0.2 }, { limit: 2_000_000, rate: 0.25 }, { limit: 5_000_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
  ]);
  return { incomeTax, socialSecurity };
}

// 中国・2026年（居住者の総合所得、単身）。個人所得税は3〜45%の7段階、基本控除¥60,000。
// 社会保険（従業員）：年金8%・医療2%・失業0.5%。月額の基数は都市ごとの上下限の間に収め、2026年は1〜6月を
// 2025年度、7〜12月を2026年度の上下限で按分します。北京は医療の大額互助金として月¥3を加えます。
// 住宅積立金（勤務先により5〜12%）、子ども以外の専項付加控除、外国人の非課税手当は未反映です。
// 子どもの専項付加控除（国家税務総局公告2023年第14号：3歳未満の乳幼児の養育・子女教育とも1人月¥2,000）は、両親の一方が100%か
// 双方が50%ずつかを選べるため、本人が全額を控除すると決まる場合（一人親、または配偶者の給与を0と入れた夫婦）だけ使います。
// 12月31日に1〜17歳の子は1年を通して対象（年¥24,000）。0歳（出生月が不明）と18歳以上（全日制の在学か不明）は数えません。
export function chinaChildDeduction(childrenAges: number[] = [], claimsFull: boolean) {
  return claimsFull ? childrenAges.filter((age) => age >= 1 && age <= 17).length * 24_000 : 0;
}
const chinaContributionBases = {
  beijing: [{ months: 6, lower: 7_162, upper: 35_811 }, { months: 6, lower: 7_270, upper: 36_348 }],
  shanghai: [{ months: 6, lower: 7_460, upper: 37_302 }, { months: 6, lower: 7_546, upper: 37_731 }],
} as const;

export function calculateChinaPayroll(grossAnnual: number, region: keyof typeof chinaContributionBases, childDeduction = 0) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const socialInsurance = chinaContributionBases[region].reduce((total, period) => {
    const base = Math.min(Math.max(monthly, period.lower), period.upper);
    return total + (base * (0.08 + 0.02 + 0.005) + (region === "beijing" ? 3 : 0)) * period.months;
  }, 0);
  const incomeTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 60_000 - socialInsurance - childDeduction), [
    { limit: 36_000, rate: 0.03 }, { limit: 144_000, rate: 0.1 }, { limit: 300_000, rate: 0.2 }, { limit: 420_000, rate: 0.25 },
    { limit: 660_000, rate: 0.3 }, { limit: 960_000, rate: 0.35 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 },
  ]);
  return { incomeTax, socialInsurance };
}

// フィリピン・2026年（居住者・単身）。所得税は2023年以降の累進税率。従業員の社会保険：SSS 5%（月額給与クレジット
// ₱5,000〜₱35,000）、PhilHealth 2.5%（月収₱10,000〜₱100,000）、Pag-IBIG 月₱200。社会保険料は課税所得から除外します。
// 13か月給与などの非課税枠（₱90,000）は未反映です。
export function calculatePhilippinesPayroll(grossAnnual: number) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const sss = Math.min(Math.max(monthly, 5_000), 35_000) * 0.05;
  const philHealth = Math.min(Math.max(monthly, 10_000), 100_000) * 0.025;
  const pagIbig = Math.min(monthly, 10_000) * 0.02;
  const socialInsurance = monthly > 0 ? (sss + philHealth + pagIbig) * 12 : 0;
  const incomeTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - socialInsurance), [
    { limit: 250_000, rate: 0 }, { limit: 400_000, rate: 0.15 }, { limit: 800_000, rate: 0.2 }, { limit: 2_000_000, rate: 0.25 }, { limit: 8_000_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
  ]);
  return { incomeTax, socialInsurance };
}

// ベトナム・2026年（居住者・単身、ホーチミン市＝地域I）。所得税は法律109/2025/QH15の5段階（月額、2026年1月から）、
// 本人控除は月₫15,500,000。社会保険（従業員）：年金等8%＋医療1.5%（上限は基本給の20倍：1〜6月₫46.8百万、7〜12月₫50.6百万）、
// 失業1%（上限は地域I最低賃金₫5.31百万の20倍）。外国人の失業保険対象外は未反映です。
// 扶養控除（決議110/2025/UBTVQH15：1人月₫6,200,000、2026年分から）は、扶養家族を両親のどちらが申告するか選べるため、
// 本人が申告すると決まる一人親か配偶者の給与を0と入れた夫婦だけ、12月31日に1〜17歳（1年を通して18歳未満）の子に使います。
// 0歳（出生月が不明）、18歳以上の子、所得のない配偶者（労働能力がない場合などに限られる）は数えません。
export function calculateVietnamPayroll(grossAnnual: number, dependants = 0) {
  const monthly = Math.max(0, grossAnnual) / 12;
  let incomeTax = 0;
  let socialInsurance = 0;
  for (const cap of [46_800_000, 50_600_000]) {
    const insurance = Math.min(monthly, cap) * 0.095 + Math.min(monthly, 106_200_000) * 0.01;
    const tax = taxFromAnnualBrackets(Math.max(0, monthly - insurance - 15_500_000 - dependants * 6_200_000), [
      { limit: 10_000_000, rate: 0.05 }, { limit: 30_000_000, rate: 0.15 }, { limit: 60_000_000, rate: 0.25 }, { limit: 100_000_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
    ]);
    incomeTax += tax * 6;
    socialInsurance += insurance * 6;
  }
  return { incomeTax, socialInsurance };
}

// ブラジル・2026年（月給×12、13か月目の給与は未反映）。INSS（従業員）は7.5/9/12/14%の累進、上限R$8,475.55。
// 所得税の基礎＝月給−max(INSS, 簡易控除R$607.20)。月額累進表（R$2,428.80まで非課税〜27.5%）の税額から、
// 法律15.270/2025の減額（月収R$5,000以下は最大R$312.89、R$7,350以下はR$978.62−0.133145×月収）を差し引きます。
export function calculateBrazilPayroll(grossAnnual: number) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const inss = taxFromAnnualBrackets(Math.min(monthly, 8_475.55), [
    { limit: 1_621, rate: 0.075 }, { limit: 2_902.84, rate: 0.09 }, { limit: 4_354.27, rate: 0.12 }, { limit: 8_475.55, rate: 0.14 },
  ]);
  const base = Math.max(0, monthly - Math.max(inss, 607.2));
  const tableTax = taxFromAnnualBrackets(base, [
    { limit: 2_428.8, rate: 0 }, { limit: 2_826.65, rate: 0.075 }, { limit: 3_751.05, rate: 0.15 }, { limit: 4_664.68, rate: 0.225 }, { limit: Number.POSITIVE_INFINITY, rate: 0.275 },
  ]);
  const reduction = monthly <= 5_000 ? 312.89 : monthly <= 7_350 ? Math.max(0, 978.62 - 0.133145 * monthly) : 0;
  // 源泉徴収はセンターボ単位のため、月額税額を1センターボ単位に丸めます。
  const incomeTax = Math.round(Math.max(0, tableTax - reduction) * 100) / 100;
  return { incomeTax: incomeTax * 12, socialInsurance: inss * 12 };
}

// 台湾・115年度（2026年、居住者・単身・標準控除）。課税所得＝給与−免税額NT$101,000−標準控除NT$136,000−給与特別控除（上限NT$227,000）。
// 労工保険（普通事故11.5%＋就業保険1%＝12.5%）の本人負担20%、健康保険（5.17%）の本人負担30%。投保額は月給を
// 下限NT$29,500（最低賃金）と上限（労保NT$45,800・健保NT$313,000）の間に収めた概算で、実際の等級表の刻みは省略します。
// 外国人の就業保険対象外、健保の補充保険料、扶養家族分の健保料は未反映です。
export function calculateTaiwanPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const monthly = gross / 12;
  const laborInsurance = monthly > 0 ? Math.min(Math.max(monthly, 29_500), 45_800) * 0.125 * 0.2 * 12 : 0;
  const healthInsurance = monthly > 0 ? Math.min(Math.max(monthly, 29_500), 313_000) * 0.0517 * 0.3 * 12 : 0;
  const taxable = Math.max(0, gross - 101_000 - 136_000 - Math.min(gross, 227_000));
  const incomeTax = taxFromAnnualBrackets(taxable, [
    { limit: 610_000, rate: 0.05 }, { limit: 1_380_000, rate: 0.12 }, { limit: 2_770_000, rate: 0.2 }, { limit: 5_190_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.4 },
  ]);
  return { incomeTax, laborInsurance, healthInsurance };
}

// 韓国・2026年（居住者・単身の給与所得者）。社会保険（本人負担）：国民年金4.75%（料率9.5%の半分。基準所得月額は1〜6月が
// 40万〜637万ウォン、7〜12月が41万〜659万ウォン）、健康保険3.595%（7.19%の半分）、長期療養保険は健康保険料×0.9448/7.19、
// 雇用保険0.9%（失業給付1.8%の半分）。所得税＝(総給与−勤労所得控除（上限2,000万）−基本控除150万（家族は下の koreaFamilyRelief2026）−年金保険料−健康・長期療養・
// 雇用保険料)に基本税率を掛け、勤労所得税額控除を差し引きます。保険料の特別所得控除（第52条）と標準税額控除13万（第59条の4第9項）は
// 併用できないため、両方を計算して税額が小さい方を採ります（低い年収では標準税額控除が有利）。
// 地方所得税は所得税の10%。非課税手当（食事代など）、健康保険料の上下限、その他の所得・税額控除は未反映です。
export function koreaEarnedIncomeDeduction2026(totalSalary: number) {
  const x = Math.max(0, totalSalary);
  const deduction = x <= 5_000_000 ? x * 0.7
    : x <= 15_000_000 ? 3_500_000 + (x - 5_000_000) * 0.4
      : x <= 45_000_000 ? 7_500_000 + (x - 15_000_000) * 0.15
        : x <= 100_000_000 ? 12_000_000 + (x - 45_000_000) * 0.05
          : 14_750_000 + (x - 100_000_000) * 0.02;
  return Math.min(deduction, 20_000_000, x);
}

export function koreaEarnedIncomeTaxCredit2026(calculatedTax: number, totalSalary: number) {
  const credit = calculatedTax <= 1_300_000 ? calculatedTax * 0.55 : 715_000 + (calculatedTax - 1_300_000) * 0.3;
  const cap = totalSalary <= 33_000_000 ? 740_000
    : totalSalary <= 70_000_000 ? Math.max(660_000, 740_000 - (totalSalary - 33_000_000) * 0.008)
      : totalSalary <= 120_000_000 ? Math.max(500_000, 660_000 - (totalSalary - 70_000_000) / 2)
        : Math.max(200_000, 500_000 - (totalSalary - 120_000_000) / 2);
  return Math.min(credit, cap);
}

// 韓国の家族の控除（2026年分、所得税法 第50条・第51条・第53条・第59条の2、法律 第21548号 附則第2条）。年齢は12月31日時点の入力で判定します。
// 基本控除（1人150万ウォン）：配偶者は給与500万ウォン以下の場合、子どもは20歳以下の日がある年（12月31日に21歳以下）。
// 一人親の追加控除100万ウォン（配偶者がなく、基本控除対象の子がいる場合）。子どもの所得はない前提です。
// 子女税額控除：基本控除対象の子のうち2026年分は9歳以上（2017年生まれ＝12月31日に9歳の子は除く）の人数で25万・55万・3人目から1人40万ウォン加算。
// 出産・入養の税額控除、女性の追加控除（第51条第1項第3号、性別を入力しないため）は未反映です。
export type KoreaFamily = { spouseSalary?: number; childrenAges?: number[]; singleParent?: boolean };

export function koreaFamilyRelief2026(family: KoreaFamily = {}) {
  const deductibleChildren = (family.childrenAges ?? []).filter((age) => age <= 21);
  const spouse = family.spouseSalary !== undefined && family.spouseSalary <= 5_000_000 ? 1 : 0;
  const singleParent = family.singleParent && deductibleChildren.length > 0 ? 1_000_000 : 0;
  const creditChildren = deductibleChildren.filter((age) => age >= 10).length;
  const childCredit = creditChildren === 0 ? 0 : creditChildren === 1 ? 250_000 : 550_000 + (creditChildren - 2) * 400_000;
  return { deduction: (spouse + deductibleChildren.length) * 1_500_000 + singleParent, childCredit };
}

export function calculateKoreaPayroll(grossAnnual: number, family: KoreaFamily = {}) {
  const gross = Math.max(0, grossAnnual);
  const relief = koreaFamilyRelief2026(family);
  const monthly = gross / 12;
  const pension = monthly > 0 ? (Math.min(Math.max(monthly, 400_000), 6_370_000) * 6 + Math.min(Math.max(monthly, 410_000), 6_590_000) * 6) * 0.0475 : 0;
  const health = gross * 0.03595;
  const longTermCare = health * 0.9448 / 7.19;
  const employment = gross * 0.009;
  const earnedIncome = gross - koreaEarnedIncomeDeduction2026(gross);
  const baseTaxable = earnedIncome - 1_500_000 - relief.deduction - pension;
  const taxAfterCredits = (taxable: number, standardCredit: number) => {
    const calculatedTax = taxFromAnnualBrackets(Math.max(0, taxable), [
      { limit: 14_000_000, rate: 0.06 }, { limit: 50_000_000, rate: 0.15 }, { limit: 88_000_000, rate: 0.24 }, { limit: 150_000_000, rate: 0.35 },
      { limit: 300_000_000, rate: 0.38 }, { limit: 500_000_000, rate: 0.4 }, { limit: 1_000_000_000, rate: 0.42 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 },
    ]);
    return Math.max(0, calculatedTax - koreaEarnedIncomeTaxCredit2026(calculatedTax, gross) - relief.childCredit - standardCredit);
  };
  const incomeTax = Math.min(
    taxAfterCredits(baseTaxable - health - longTermCare - employment, 0),
    taxAfterCredits(baseTaxable, 130_000),
  );
  const localIncomeTax = incomeTax * 0.1;
  return { incomeTax, localIncomeTax, pension, health: health + longTermCare, employment };
}

// インドネシア・2026年（居住者・単身、PTKP Rp54,000,000）。従業員の社会保険：JHT 2%（上限なし）、JP 1%（月額上限は1〜2月Rp10,547,400、
// 3〜12月Rp11,086,300）、JKN（医療）1%（月額上限Rp12,000,000）。会社負担のJKK（最低リスク0.24%と仮定）・JKM 0.30%・JKN 4%は課税所得に加算します。
// 課税所得＝総額−職務費用（5%・上限年Rp6,000,000）−JHT・JP−PTKP（千ルピア未満切り捨て）。外国人のJP対象外、扶養控除は未反映です。
export function calculateIndonesiaPayroll(grossAnnual: number) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const jht = monthly * 0.02 * 12;
  const jp = Math.min(monthly, 10_547_400) * 0.01 * 2 + Math.min(monthly, 11_086_300) * 0.01 * 10;
  const jkn = Math.min(monthly, 12_000_000) * 0.01 * 12;
  const employerPremiums = (monthly * (0.0024 + 0.003) + Math.min(monthly, 12_000_000) * 0.04) * 12;
  const bruto = monthly * 12 + employerPremiums;
  const netto = bruto - Math.min(bruto * 0.05, 6_000_000) - jht - jp;
  const taxable = Math.floor(Math.max(0, netto - 54_000_000) / 1_000) * 1_000;
  const incomeTax = taxFromAnnualBrackets(taxable, [
    { limit: 60_000_000, rate: 0.05 }, { limit: 250_000_000, rate: 0.15 }, { limit: 500_000_000, rate: 0.25 }, { limit: 5_000_000_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
  ]);
  return { incomeTax, pension: jht + jp, health: jkn };
}

// インド・新税制（既定の税制）。2025年予算で改定され、2026-27年度も据え置き。給与所得者の標準控除₹75,000、
// 課税所得₹12 lakh以下は87条Aの税額控除（上限₹60,000）で0、わずかに超える場合は超過額までに抑えます（marginal relief）。
// 付加税は₹50 lakh超10%・₹1 crore超15%・₹2 crore超25%（新税制の上限）で、閾値でのmarginal reliefを反映。最後に教育目的税4%。
// EPF（従業員積立基金）は基本給の構成や加入区分で大きく変わるため含めません。
const INDIA_SLABS: TaxSlice[] = [
  { limit: 400_000, rate: 0 }, { limit: 800_000, rate: 0.05 }, { limit: 1_200_000, rate: 0.1 }, { limit: 1_600_000, rate: 0.15 },
  { limit: 2_000_000, rate: 0.2 }, { limit: 2_400_000, rate: 0.25 }, { limit: Number.POSITIVE_INFINITY, rate: 0.3 },
];
const INDIA_SURCHARGE = [{ threshold: 20_000_000, rate: 0.25 }, { threshold: 10_000_000, rate: 0.15 }, { threshold: 5_000_000, rate: 0.1 }];

function indiaTaxWithSurcharge(taxable: number): number {
  const base = taxFromAnnualBrackets(taxable, INDIA_SLABS);
  const tier = INDIA_SURCHARGE.find((item) => taxable > item.threshold);
  if (!tier) return base;
  return Math.min(base * (1 + tier.rate), indiaTaxWithSurcharge(tier.threshold) + (taxable - tier.threshold));
}

export function calculateIndiaIncomeTax(grossAnnual: number) {
  const taxable = Math.max(0, grossAnnual - 75_000);
  const tax = taxable <= 1_200_000 ? 0 : Math.min(indiaTaxWithSurcharge(taxable), taxable - 1_200_000);
  return tax * 1.04;
}

// マレーシア・2026課税年度（居住者・単身、外国人被用者）。課税所得＝給与−本人控除RM9,000−EPF（上限RM4,000）。
// 税額は内国歳入庁PCB仕様書（2026年）の表1（P・M・R・B）どおり、(P−M)×R＋B。課税所得RM35,000以下のBはRM400の税額控除を含みます。
// 外国人のEPF本人負担は2%（2025年10月分の給与から）。SOCSOの労災部門は雇用主負担、EISは外国人に適用されません。
const malaysiaTaxTable = [
  { from: 2_000_000, rate: 0.3, base: 528_400 }, { from: 600_000, rate: 0.28, base: 136_400 }, { from: 400_000, rate: 0.26, base: 84_400 },
  { from: 100_000, rate: 0.25, base: 9_400 }, { from: 70_000, rate: 0.19, base: 3_700 }, { from: 50_000, rate: 0.11, base: 1_500 },
  { from: 35_000, rate: 0.06, base: 600 }, { from: 20_000, rate: 0.03, base: -250 }, { from: 5_000, rate: 0.01, base: -400 },
] as const;

export function calculateMalaysiaPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const epf = gross * 0.02;
  const chargeable = Math.max(0, gross - 9_000 - Math.min(epf, 4_000));
  const row = malaysiaTaxTable.find((item) => chargeable > item.from);
  const incomeTax = row ? Math.max(0, (chargeable - row.from) * row.rate + row.base) : 0;
  return { incomeTax, epf };
}

// ポルトガル・2026年（居住者・単身の給与所得者、IRS Jovemなどの特例なし）。社会保険（Segurança Social）は本人11%（上限なし）。
// 所得税法（CIRS）：給与所得控除＝max(IAS×8.54, 社会保険料)（第25条、IAS 2026＝€537.13）。最低生活保障（第70条）の控除を
// 課税所得から差し引き、第68条の税率表（法律73-A/2025による現行法）で累進課税。課税所得€80,000超は連帯付加税（第68-A条）。
// 一般家計支出の税額控除（第78-B条：支出の35%、上限€250）は満額使えると仮定します。2026年9月に閣議決定された
// 1〜6段階の税率引き下げ法案は、国会で成立していないため反映していません。
const PORTUGAL_IAS_2026 = 537.13;
const PORTUGAL_FIRST_BRACKET = { limit: 8_342, rate: 0.125 };
const PORTUGAL_GENERAL_EXPENSES_CREDIT = 250;
const portugalBrackets: TaxSlice[] = [
  PORTUGAL_FIRST_BRACKET, { limit: 12_587, rate: 0.157 }, { limit: 17_838, rate: 0.212 }, { limit: 23_089, rate: 0.241 }, { limit: 29_397, rate: 0.311 },
  { limit: 43_090, rate: 0.349 }, { limit: 46_566, rate: 0.431 }, { limit: 86_634, rate: 0.446 }, { limit: Number.POSITIVE_INFINITY, rate: 0.48 },
];

export function calculatePortugalPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const socialSecurity = gross * 0.11;
  const specificDeduction = Math.min(gross, Math.max(PORTUGAL_IAS_2026 * 8.54, socialSecurity));
  // 第70条：参照額は€12,880と1.5×14×IASの大きい方。総収入が2.2×14×IASを超える場合は適用しません。
  const reference = Math.max(12_880, 1.5 * 14 * PORTUGAL_IAS_2026);
  const generalExpensesAsIncome = PORTUGAL_GENERAL_EXPENSES_CREDIT / PORTUGAL_FIRST_BRACKET.rate;
  const upperLimit = reference - PORTUGAL_GENERAL_EXPENSES_CREDIT / (PORTUGAL_FIRST_BRACKET.rate * 3.6) + PORTUGAL_FIRST_BRACKET.limit / 3.6;
  let minimumExistence = 0;
  if (gross <= 2.2 * 14 * PORTUGAL_IAS_2026) {
    const raw = gross <= reference ? reference - (specificDeduction + generalExpensesAsIncome)
      : gross <= upperLimit ? reference - 2.6 * (gross - reference) - (specificDeduction + generalExpensesAsIncome)
        : upperLimit - PORTUGAL_FIRST_BRACKET.limit - 1.35 * (gross - upperLimit) - specificDeduction;
    minimumExistence = Math.min(Math.max(0, raw), gross - specificDeduction);
  }
  const taxable = Math.max(0, gross - specificDeduction - minimumExistence);
  const normalTax = Math.max(0, taxFromAnnualBrackets(taxable, portugalBrackets) - PORTUGAL_GENERAL_EXPENSES_CREDIT);
  const solidarity = Math.max(0, Math.min(taxable, 250_000) - 80_000) * 0.025 + Math.max(0, taxable - 250_000) * 0.05;
  return { incomeTax: normalTax + solidarity, socialSecurity, taxable };
}

// スペイン・マドリード州・2026年（居住者・単身、65歳未満、給与以外の所得なし）。社会保険（本人）：共通6.50%
// （共通4.70%＋失業1.55%＋職業訓練0.10%＋MEI 0.15%、上限は月€5,101.20）と、上限超過分の連帯追加保険料の本人負担
// （1.15%／1.25%／1.46%のうち本人0.19%／0.21%／0.24%。Orden PJC/297/2026が明記する本人負担分）。
// 所得税（IRPF）：給与−社会保険料−必要経費€2,000−勤労所得減額（第20条）を課税所得とし、国の税率表（第63条）と
// マドリード州の税率表（州法第1条）でそれぞれ課税し、本人控除（国€5,550・州€5,956.65）に相当する税額を差し引きます。
// 低所得の給与所得者の税額控除（追加規定第61条、2026年）を反映。州独自の税額控除（家賃など）は未反映です。
const SPAIN_MAX_MONTHLY_BASE_2026 = 5_101.2;
const spainStateScale: TaxSlice[] = [
  { limit: 12_450, rate: 0.095 }, { limit: 20_200, rate: 0.12 }, { limit: 35_200, rate: 0.15 }, { limit: 60_000, rate: 0.185 }, { limit: 300_000, rate: 0.225 }, { limit: Number.POSITIVE_INFINITY, rate: 0.245 },
];
const madridScale: TaxSlice[] = [
  { limit: 13_362.22, rate: 0.085 }, { limit: 19_004.63, rate: 0.107 }, { limit: 35_425.68, rate: 0.128 }, { limit: 57_320.4, rate: 0.174 }, { limit: Number.POSITIVE_INFINITY, rate: 0.205 },
];

export function calculateSpainMadridPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const monthly = gross / 12;
  const excess = Math.max(0, monthly - SPAIN_MAX_MONTHLY_BASE_2026);
  const solidarity = taxFromAnnualBrackets(excess, [
    { limit: SPAIN_MAX_MONTHLY_BASE_2026 * 0.1, rate: 0.0019 }, { limit: SPAIN_MAX_MONTHLY_BASE_2026 * 0.5, rate: 0.0021 }, { limit: Number.POSITIVE_INFINITY, rate: 0.0024 },
  ]);
  const socialSecurity = (Math.min(monthly, SPAIN_MAX_MONTHLY_BASE_2026) * 0.065 + solidarity) * 12;
  const netWork = gross - socialSecurity;
  const reduction = netWork <= 14_852 ? 7_302
    : netWork <= 17_673.52 ? 7_302 - 1.75 * (netWork - 14_852)
      : netWork < 19_747.5 ? 2_364.34 - 1.14 * (netWork - 17_673.52) : 0;
  const taxable = Math.max(0, netWork - 2_000 - reduction);
  const stateTax = Math.max(0, taxFromAnnualBrackets(taxable, spainStateScale) - taxFromAnnualBrackets(Math.min(taxable, 5_550), spainStateScale));
  const regionalTax = Math.max(0, taxFromAnnualBrackets(taxable, madridScale) - taxFromAnnualBrackets(Math.min(taxable, 5_956.65), madridScale));
  // 追加規定第61条：給与€17,094以下は€590.89、€20,048.45未満は€590.89−0.2×(給与−€17,094)。国・州の税額の合計が上限。
  const workCredit = Math.min(stateTax + regionalTax, gross <= 17_094 ? 590.89 : gross < 20_048.45 ? 590.89 - 0.2 * (gross - 17_094) : 0);
  return { stateTax: Math.max(0, stateTax - workCredit), regionalTax: regionalTax - Math.max(0, workCredit - stateTax), socialSecurity, taxable };
}

// コロンビア・2026課税年度（居住者・単身、通常給与。salario integralではない）。UVT＝$52,374、最低賃金＝$1,750,905（政令0159/2026、暫定）。
// 本人負担の社会保険（年収を12で割った月額を最低賃金1倍〜25倍の範囲に収めた額が基礎）：年金4%、医療4%、
// 年金連帯基金（最低賃金4倍以上で1%、16倍以上は0.2〜1%を上乗せ）。年金改革法（法律2381/2024）は2027年4月1日から施行。
// 課税所得＝給与−社会保険料（非課税）−給与の25%の非課税所得（年790 UVTまで。控除合計は40%・1,340 UVTが上限）。第241条の税率表（UVT建て）。
// 扶養控除、任意年金・AFC、電子インボイスの購入額1%控除、賞与・手当の区別は未反映です。
const COLOMBIA_UVT_2026 = 52_374;
const COLOMBIA_MINIMUM_WAGE_2026 = 1_750_905;
const colombiaTariffUvt = [
  { lower: 31_000, rate: 0.39, fixed: 10_352 }, { lower: 18_970, rate: 0.37, fixed: 5_901 }, { lower: 8_670, rate: 0.35, fixed: 2_296 },
  { lower: 4_100, rate: 0.33, fixed: 788 }, { lower: 1_700, rate: 0.28, fixed: 116 }, { lower: 1_090, rate: 0.19, fixed: 0 },
] as const;

export function calculateColombiaPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const monthly = gross / 12;
  const base = monthly > 0 ? Math.min(Math.max(monthly, COLOMBIA_MINIMUM_WAGE_2026), 25 * COLOMBIA_MINIMUM_WAGE_2026) : 0;
  const wages = base / COLOMBIA_MINIMUM_WAGE_2026;
  const solidarityFund = (wages >= 4 ? 0.01 : 0) + (wages > 20 ? 0.01 : wages >= 19 ? 0.008 : wages >= 18 ? 0.006 : wages >= 17 ? 0.004 : wages >= 16 ? 0.002 : 0);
  const pension = base * (0.04 + solidarityFund) * 12;
  const health = base * 0.04 * 12;
  const netIncome = Math.max(0, gross - pension - health);
  const exempt = Math.min(netIncome * 0.25, 790 * COLOMBIA_UVT_2026, netIncome * 0.4, 1_340 * COLOMBIA_UVT_2026);
  const taxableUvt = (netIncome - exempt) / COLOMBIA_UVT_2026;
  const row = colombiaTariffUvt.find((item) => taxableUvt > item.lower);
  const incomeTax = row ? ((taxableUvt - row.lower) * row.rate + row.fixed) * COLOMBIA_UVT_2026 : 0;
  return { incomeTax, pension, health };
}

// アルゼンチン・2026年（居住者・単身の給与所得者）。年収は月給12か月分とSAC（13か月目の給与）の合計として扱い、月給＝年収÷13。
// 本人負担：年金11%・PAMI 3%・社会保障医療3%。拠出の月額上限は物価連動で毎月改定され、11・12月分が未公表のため、
// 月給が2026年1月の上限$3,823,372.95（ANSES決議381/2025）以下の場合だけ計算し、それを超える給与はnull（計算不能）を返します。
// 所得税（Ganancias）：ARCAの2026年分の年間表（最低課税所得・特別控除（第30条c)2、4.8倍）と、その合計の1/12の加算）と第94条の年間税率表。
// 家族控除・その他の控除は未反映です。
export const ARGENTINA_MIN_VERIFIED_MONTHLY_CAP_2026 = 3_823_372.95;
const ARGENTINA_PERSONAL_DEDUCTIONS_2026 = (6_019_671.36 + 28_894_422.56) * (13 / 12);
const argentinaScale2026: TaxSlice[] = [
  { limit: 2_168_491.89, rate: 0.05 }, { limit: 4_336_983.77, rate: 0.09 }, { limit: 6_505_475.65, rate: 0.12 }, { limit: 9_758_213.49, rate: 0.15 }, { limit: 19_516_426.99, rate: 0.19 },
  { limit: 29_274_640.48, rate: 0.23 }, { limit: 43_911_960.73, rate: 0.27 }, { limit: 65_867_941.1, rate: 0.31 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
];

export function calculateArgentinaPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  if (gross / 13 > ARGENTINA_MIN_VERIFIED_MONTHLY_CAP_2026) return null;
  const socialSecurity = gross * 0.17;
  const incomeTax = taxFromAnnualBrackets(Math.max(0, gross - socialSecurity - ARGENTINA_PERSONAL_DEDUCTIONS_2026), argentinaScale2026);
  // PAMI（高齢者医療）は医療保険として表示します。
  return { incomeTax, pension: gross * 0.11, health: gross * 0.06 };
}

// チリ・2026年（居住者・単身・期間の定めのない雇用契約の給与所得者）。11・12月のUTMとUFが未公表のため、
// 公表済みの直近月である2026年9月の月額（UTM $71,721、UF $41,057.20＝9月30日）を12か月に当てはめます。
// 本人負担：年金10%＋AFP手数料0.46%（2025年10月〜2027年9月に初めて加入する人はAFP Unoに加入）、医療7%（FONASAの法定率）、
// いずれも月90 UFが上限。失業保険0.6%（上限135.2 UF）。障害・遺族保険（SIS）と改革法の追加拠出は会社負担です。
// 課税所得＝月給−本人負担の社会保険料。SIIの2026年9月の第二種単一税の月額表（控除額方式）を適用し、年額は12倍です。
// ISAPREの7%を超える契約額、任意年金（APV）、外国人技術者の年金免除（法律18.156）は未反映です。
const CHILE_UF_2026_09_30 = 41_057.2;
const chileSecondCategoryTaxSeptember2026 = [
  { above: 22_233_510, factor: 0.4, rebate: 2_784_209.22 }, { above: 8_606_520, factor: 0.35, rebate: 1_672_533.72 }, { above: 6_454_890, factor: 0.304, rebate: 1_276_633.8 },
  { above: 5_020_470, factor: 0.23, rebate: 798_971.94 }, { above: 3_586_050, factor: 0.135, rebate: 322_027.29 }, { above: 2_151_630, factor: 0.08, rebate: 124_794.54 },
  { above: 968_233.5, factor: 0.04, rebate: 38_729.34 },
] as const;

export function calculateChilePayroll(grossAnnual: number) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const pensionHealthBase = Math.min(monthly, 90 * CHILE_UF_2026_09_30);
  const pensionMonthly = pensionHealthBase * (0.1 + 0.0046);
  const healthMonthly = pensionHealthBase * 0.07;
  const unemploymentMonthly = Math.min(monthly, 135.2 * CHILE_UF_2026_09_30) * 0.006;
  const taxable = Math.max(0, monthly - pensionMonthly - healthMonthly - unemploymentMonthly);
  const row = chileSecondCategoryTaxSeptember2026.find((item) => taxable > item.above);
  const incomeTaxMonthly = row ? taxable * row.factor - row.rebate : 0;
  return { incomeTax: incomeTaxMonthly * 12, pension: pensionMonthly * 12, health: healthMonthly * 12, unemployment: unemploymentMonthly * 12 };
}

// フランス・2026年（民間部門の非管理職・単身・1 part）。本人負担（CLEISS・URSSAFの2026年の料率）：
// 老齢保険 6.90%（社会保障の上限 PASS 年€48,060まで）＋0.40%（全額）、補足年金AGIRC-ARRCO 第1区分3.15%＋CEG 0.86%
// （PASSまで）、第2区分8.64%＋CEG 1.08%（PASS〜8倍）、CET 0.14%（PASS超の給与の全額、8倍まで）。医療・失業の本人負担は0。
// CSG 9.2%（うち6.8%は課税所得から控除）とCRDS 0.5%は給与の98.25%（PASSの4倍まで。超える部分は100%）にかかります。
// 課税所得＝給与−社会保険料−控除できるCSG、そこから10%の概算控除（最低€509・最高€14,555）。所得税は2026年の税率表
// （1 part）、税額€1,982以下はdécote（€897−税額×45.25%）、€61未満は徴収しません（service-public.fr）。
// 補足医療保険（mutuelle）・労働不能保険の本人負担、€250,000超の高額所得者向け付加税は未反映。
export const FRANCE_PASS_2026 = 48_060;

export function calculateFrancePayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const tranche1 = Math.min(gross, FRANCE_PASS_2026);
  const tranche2 = Math.min(Math.max(0, gross - FRANCE_PASS_2026), FRANCE_PASS_2026 * 7);
  const basicPension = tranche1 * 0.069 + gross * 0.004;
  const complementaryPension = tranche1 * (0.0315 + 0.0086) + tranche2 * (0.0864 + 0.0108) + (gross > FRANCE_PASS_2026 ? Math.min(gross, FRANCE_PASS_2026 * 8) * 0.0014 : 0);
  const pension = basicPension + complementaryPension;
  const csgBase = Math.min(gross, FRANCE_PASS_2026 * 4) * 0.9825 + Math.max(0, gross - FRANCE_PASS_2026 * 4);
  const deductibleCsg = csgBase * 0.068;
  const csgCrds = csgBase * (0.068 + 0.024 + 0.005);
  const netTaxableSalary = Math.max(0, gross - pension - deductibleCsg);
  const allowance = Math.min(netTaxableSalary, Math.min(14_555, Math.max(509, netTaxableSalary * 0.1)));
  const taxableIncome = netTaxableSalary - allowance;
  const grossTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 11_600, rate: 0 }, { limit: 29_579, rate: 0.11 }, { limit: 84_577, rate: 0.3 }, { limit: 181_917, rate: 0.41 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
  const decote = grossTax <= 1_982 ? Math.min(grossTax, Math.max(0, 897 - grossTax * 0.4525)) : 0;
  const afterDecote = grossTax - decote;
  const incomeTax = afterDecote < 61 ? 0 : afterDecote;
  return { pension, csgCrds, deductibleCsg, netTaxableSalary, taxableIncome, grossTax, decote, incomeTax };
}

// イタリア・2026年（居住者・単身の給与所得者、ローマ＝ラツィオ州、ミラノ＝ロンバルディア州）。
// 年金保険料：本人9.19%と、第1区分€56,224を超える部分に1%（INPS通達2026年第6号）。1996年以降に初めて加入した人
// （日本からの移住者）は保険料の基礎が年€122,295までに制限されます。課税所得（reddito complessivo）＝給与−年金保険料。
// IRPEF（TUIR第11条、2026年）：€28,000まで23%、€50,000まで33%、超過分43%。そこから給与所得の税額控除（TUIR第13条1項・
// 1.1項）と追加の税額控除（法律207/2024第1条6項、2026年は有効・2027年に廃止）を税額の範囲で差し引きます。
// 課税所得€20,000以下の非課税の追加給付（同4項）と低所得者の給付（trattamento integrativo）は未反映（手取りは実際より少なめ）。
// IRPEFが0になる人には地方付加税もかかりません。
export const ITALY_INPS_FIRST_BAND_2026 = 56_224;
export const ITALY_INPS_CEILING_2026 = 122_295;

export function italyEmployeeTaxCredit2026(reddito: number) {
  const r = Math.max(0, reddito);
  let credit = 0;
  if (r <= 15_000) credit = 1_955;
  else if (r <= 28_000) credit = 1_910 + 1_190 * (28_000 - r) / 13_000;
  else if (r <= 50_000) credit = 1_910 * (50_000 - r) / 22_000;
  if (r > 25_000 && r <= 35_000) credit += 65;
  return credit;
}

export function italyAdditionalCredit2026(reddito: number) {
  if (reddito <= 20_000 || reddito > 40_000) return 0;
  if (reddito <= 32_000) return 1_000;
  return 1_000 * (40_000 - reddito) / 8_000;
}

export function calculateItalyPayroll(grossAnnual: number, taxRegion: string) {
  const gross = Math.max(0, grossAnnual);
  const base = Math.min(gross, ITALY_INPS_CEILING_2026);
  const pension = base * 0.0919 + Math.max(0, base - ITALY_INPS_FIRST_BAND_2026) * 0.01;
  const reddito = Math.max(0, gross - pension);
  const grossTax = taxFromAnnualBrackets(reddito, [{ limit: 28_000, rate: 0.23 }, { limit: 50_000, rate: 0.33 }, { limit: Number.POSITIVE_INFINITY, rate: 0.43 }]);
  const credits = italyEmployeeTaxCredit2026(reddito) + italyAdditionalCredit2026(reddito);
  const nationalTax = Math.max(0, grossTax - credits);
  // 地方付加税：ローマはラツィオ州（課税所得€28,000以下は全体に1.73%、超えると€15,000まで1.73%・超過分3.33%、
  // €28,001〜30,000は€60を控除。州法2025年第20号）とローマ市0.9%（課税所得€14,000以下は免除、超えると全体に課税）。
  // ミラノはロンバルディア州の累進税率（1.23/1.58/1.72/1.73%）と、課税所得€23,000超で所得全体にかかる市税0.8%。
  let localTax = 0;
  if (nationalTax > 0) {
    localTax = taxRegion === "lombardy"
      ? taxFromAnnualBrackets(reddito, [{ limit: 15_000, rate: 0.0123 }, { limit: 28_000, rate: 0.0158 }, { limit: 50_000, rate: 0.0172 }, { limit: Number.POSITIVE_INFINITY, rate: 0.0173 }]) + (reddito > 23_000 ? reddito * 0.008 : 0)
      : Math.max(0, (reddito <= 28_000 ? reddito * 0.0173 : 15_000 * 0.0173 + (reddito - 15_000) * 0.0333) - (reddito > 28_000 && reddito <= 30_000 ? 60 : 0)) + (reddito > 14_000 ? reddito * 0.009 : 0);
  }
  return { pension, reddito, grossTax, credits, nationalTax, localTax };
}

// メキシコ・IMSSの本人負担（社会保障法、2026年1月15日改正版）。保険料の基礎（SBC）は年収÷365の日額で、上限はUMAの25倍
// （第28条）。医療：現金給付0.25%（第107条）、年金受給者の医療0.375%（第25条）、UMAの3倍を超える部分に0.40%（第106条II、
// 経過規定第19条で2%から引き下げ）。年金：障害・遺族0.625%（第147条）、老齢・高齢退職1.125%（第168条II b）。
// UMAの日額は2026年1月が$113.14、2月から$117.31（INEGI、2026年1月9日官報）。
export function calculateMexicoImssEmployee2026(grossAnnual: number) {
  const daily = Math.max(0, grossAnnual) / 365;
  let health = 0;
  let pension = 0;
  for (const [days, uma] of [[31, 113.14], [334, 117.31]] as const) {
    const base = Math.min(daily, uma * 25);
    health += days * (base * (0.0025 + 0.00375) + Math.max(0, base - uma * 3) * 0.004);
    pension += days * base * (0.00625 + 0.01125);
  }
  return { health, pension };
}

export function taxCalculationStatus(city: City): TaxCalculationStatus {
  if (city.taxSystem === "estimate") return "unavailable";
  if (city.taxSystem === "spain" && city.taxRegion !== "madrid") return "unavailable";
  if (city.taxSystem === "switzerland" && city.taxRegion !== "zurich") return "unavailable";
  if (city.taxSystem === "china" && !["beijing", "shanghai"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "canada" && !["britishColumbia", "ontario", "alberta", "quebec"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "us" && !["california", "newYork", "texas", "florida", "washington", "massachusetts", "illinois", "districtOfColumbia"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "uk" && !["england", "scotland"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "italy" && !["lazio", "lombardy"].includes(city.taxRegion)) return "unavailable";
  if (["singapore", "uae", "saudiArabia"].includes(city.taxSystem)) return "official-scenario";
  return "official-rate-estimate";
}

export function officialSalaryBenchmarkSource<TCity extends City>(city: TCity): TCity["dataSources"][number] | null {
  const salarySource = city.dataSources.find((item) => item.item.startsWith("給与"));
  if (!salarySource || /Life Atlas|推定|保存参考値/.test(salarySource.source)) return null;
  return salarySource;
}

function estimateTaxBreakdown(city: City, grossAnnual: number, ageBand: AgeBand, household: keyof typeof householdMultipliers, expatTaxRegime: boolean, familyInput: Omit<JapanFamily, "singleParent"> = {}) {
  // ひとり親控除は世帯区分から判定し、ホームとOffer Analyzerで同じ結果にします。
  const family: JapanFamily = { ...familyInput, singleParent: household === "singleParent" };
  if (taxCalculationStatus(city) === "unavailable") return null;
  if (city.taxSystem === "singapore") {
    const incomeTax = taxFromAnnualBrackets(grossAnnual, [
      { limit: 20_000, rate: 0 }, { limit: 30_000, rate: 0.02 }, { limit: 40_000, rate: 0.035 },
      { limit: 80_000, rate: 0.07 }, { limit: 120_000, rate: 0.115 }, { limit: 160_000, rate: 0.15 },
      { limit: 200_000, rate: 0.18 }, { limit: 240_000, rate: 0.19 }, { limit: 280_000, rate: 0.195 },
      { limit: 320_000, rate: 0.2 }, { limit: 500_000, rate: 0.22 }, { limit: 1_000_000, rate: 0.23 },
      { limit: Number.POSITIVE_INFINITY, rate: 0.24 },
    ]);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, totalTaxMonthly: incomeTax / 12, totalDeductionsMonthly: incomeTax / 12 };
  }
  // UAE・サウジアラビアは給与に個人所得税がなく、外国人従業員の社会保険の本人負担もありません。
  if (city.taxSystem === "uae" || city.taxSystem === "saudiArabia") return emptyTaxBreakdown();
  if (city.taxSystem === "india") {
    const incomeTax = calculateIndiaIncomeTax(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, totalTaxMonthly: incomeTax / 12, totalDeductionsMonthly: incomeTax / 12 };
  }
  if (city.taxSystem === "china" && (city.taxRegion === "beijing" || city.taxRegion === "shanghai")) {
    const married = isMarriedHousehold(household);
    const claimsFull = household === "singleParent" || (married && family.spouseSalary === 0);
    const { incomeTax, socialInsurance } = calculateChinaPayroll(grossAnnual, city.taxRegion, chinaChildDeduction(family.childrenAges, claimsFull));
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "portugal") {
    const regular = calculatePortugalPayroll(grossAnnual);
    const { socialSecurity } = regular;
    const incomeTax = expatTaxRegime ? portugalIficiTax2026(grossAnnual) ?? regular.incomeTax : regular.incomeTax;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialSecurity / 12, totalDeductionsMonthly: (incomeTax + socialSecurity) / 12 };
  }
  if (city.taxSystem === "spain") {
    const regular = calculateSpainMadridPayroll(grossAnnual);
    const { socialSecurity } = regular;
    // 特別制度では州の税がなく、24%/47%の1本の税額になります。
    const stateTax = expatTaxRegime ? spainImpatriateTax2026(grossAnnual) : regular.stateTax;
    const regionalTax = expatTaxRegime ? 0 : regular.regionalTax;
    const totalTax = stateTax + regionalTax;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: stateTax / 12, residentTaxMonthly: regionalTax / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: socialSecurity / 12, totalDeductionsMonthly: (totalTax + socialSecurity) / 12 };
  }
  if (city.taxSystem === "colombia") {
    const { incomeTax, pension, health } = calculateColombiaPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: (pension + health) / 12, totalDeductionsMonthly: (incomeTax + pension + health) / 12 };
  }
  if (city.taxSystem === "chile") {
    const { incomeTax, pension, health, unemployment } = calculateChilePayroll(grossAnnual);
    const totalInsurance = pension + health + unemployment;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: unemployment / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "argentina") {
    // 拠出上限が未公表の月（11・12月）に影響する給与帯は計算しません。
    const payroll = calculateArgentinaPayroll(grossAnnual);
    if (payroll === null) return null;
    const { incomeTax, pension, health } = payroll;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: (pension + health) / 12, totalDeductionsMonthly: (incomeTax + pension + health) / 12 };
  }
  if (city.taxSystem === "malaysia") {
    const { incomeTax, epf } = calculateMalaysiaPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: epf / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: epf / 12, totalDeductionsMonthly: (incomeTax + epf) / 12 };
  }
  if (city.taxSystem === "indonesia") {
    const { incomeTax, pension, health } = calculateIndonesiaPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: (pension + health) / 12, totalDeductionsMonthly: (incomeTax + pension + health) / 12 };
  }
  if (city.taxSystem === "korea") {
    const payroll = calculateKoreaPayroll(grossAnnual, family);
    const { pension, health, employment } = payroll;
    const { incomeTax, localIncomeTax } = expatTaxRegime ? koreaForeignWorkerFlatTax2026(grossAnnual) : payroll;
    const totalTax = incomeTax + localIncomeTax;
    const totalInsurance = pension + health + employment;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, residentTaxMonthly: localIncomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "taiwan") {
    const { incomeTax, laborInsurance, healthInsurance } = calculateTaiwanPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: healthInsurance / 12, pensionMonthly: laborInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: (laborInsurance + healthInsurance) / 12, totalDeductionsMonthly: (incomeTax + laborInsurance + healthInsurance) / 12 };
  }
  if (city.taxSystem === "brazil") {
    const { incomeTax, socialInsurance } = calculateBrazilPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "vietnam") {
    const married = isMarriedHousehold(household);
    const claimsDependants = household === "singleParent" || (married && family.spouseSalary === 0);
    const vietnamDependants = claimsDependants ? (family.childrenAges ?? []).filter((age) => age >= 1 && age <= 17).length : 0;
    const { incomeTax, socialInsurance } = calculateVietnamPayroll(grossAnnual, vietnamDependants);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "philippines") {
    const { incomeTax, socialInsurance } = calculatePhilippinesPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "thailand") {
    const married = isMarriedHousehold(household);
    const { incomeTax, socialSecurity } = calculateThailandPayroll(grossAnnual, { spouseSalary: married ? family.spouseSalary : undefined, childrenAges: family.childrenAges });
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialSecurity / 12, totalDeductionsMonthly: (incomeTax + socialSecurity) / 12 };
  }
  if (city.taxSystem === "germany") {
    const { incomeTax, solidarity, pension, unemployment, health, care } = calculateGermanyPayroll(grossAnnual, household);
    const totalTax = incomeTax + solidarity;
    const totalInsurance = pension + unemployment + health + care;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, reconstructionSurtaxMonthly: solidarity / 12, healthInsuranceMonthly: health / 12, careInsuranceMonthly: care / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: unemployment / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "ireland") {
    const married = isMarriedHousehold(household);
    const status: IrelandFilingStatus = married && family.spouseSalary === 0 ? "marriedOneIncome"
      : household === "singleParent" && (family.childrenAges ?? []).some((age) => age <= 18) ? "singleParent" : "single";
    const { incomeTax, usc, prsi } = calculateIrelandPayrollTax(grossAnnual, status);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, residentTaxMonthly: usc / 12, pensionMonthly: prsi / 12, totalTaxMonthly: (incomeTax + usc) / 12, totalInsuranceMonthly: prsi / 12, totalDeductionsMonthly: (incomeTax + usc + prsi) / 12 };
  }
  if (city.taxSystem === "netherlands") {
    // 年齢帯からAOW年齢（2026年は67歳）以上かを判定できないため、65歳以上は計算しません。
    if (ageBand === "65plus") return null;
    const payroll = calculateNetherlandsPayroll(grossAnnual - (expatTaxRegime ? netherlandsExpatAllowance2026(grossAnnual) : 0));
    // Box 1は所得税と国民保険料を一体で課税し、税額控除も合算額から差し引くため、1行の税額として示します。
    const levy = payroll.box1AfterCredits;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: levy / 12, totalTaxMonthly: levy / 12, totalDeductionsMonthly: levy / 12 };
  }
  if (city.taxSystem === "switzerland") {
    // 65歳以上はAHVの基準年齢に達し、AHVの控除額・失業保険・企業年金の扱いが変わるため計算しません。
    if (ageBand === "65plus") return null;
    const payroll = calculateZurichPayroll(grossAnnual);
    const totalTax = payroll.federalTax + payroll.cantonCityTax;
    const pension = payroll.ahv + payroll.bvg;
    const totalInsurance = pension + payroll.alv + payroll.nbu;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: payroll.federalTax / 12, residentTaxMonthly: payroll.cantonCityTax / 12, healthInsuranceMonthly: payroll.nbu / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: payroll.alv / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "hongKong") {
    const { salariesTax, mpf } = calculateHongKongSalariesTax(grossAnnual, household, family.spouseSalary);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: salariesTax / 12, pensionMonthly: mpf / 12, totalTaxMonthly: salariesTax / 12, totalInsuranceMonthly: mpf / 12, totalDeductionsMonthly: (salariesTax + mpf) / 12 };
  }
  if (city.taxSystem === "japan") {
    const insurance = calculateJapanInsurance(city, grossAnnual, ageBand);
    const totalInsurance = insurance.healthInsurance + insurance.childSupport + insurance.careInsurance + insurance.pension + insurance.employment;
    const salaryIncome = Math.max(0, grossAnnual - japaneseSalaryDeduction(grossAnnual));
    const familyDeductions = japanFamilyDeductions(salaryIncome, family);
    const taxableIncome = Math.floor(Math.max(0, salaryIncome - japaneseBasicDeduction(grossAnnual) - totalInsurance - familyDeductions.incomeTax) / 1_000) * 1_000;
    const nationalTax = progressiveTax(taxableIncome, [
      { limit: 1_950_000, rate: 0.05 },
      { limit: 3_300_000, rate: 0.1 },
      { limit: 6_950_000, rate: 0.2 },
      { limit: 9_000_000, rate: 0.23 },
      { limit: 18_000_000, rate: 0.33 },
      { limit: 40_000_000, rate: 0.4 },
      { limit: Number.POSITIVE_INFINITY, rate: 0.45 },
    ]);
    const reconstructionSurtax = nationalTax * 0.021;
    const residentTaxBase = Math.max(0, salaryIncome - 430_000 - totalInsurance - familyDeductions.residentTax);
    const residentTax = residentTaxBase * 0.1 + 5_000;
    const totalTax = nationalTax + reconstructionSurtax + residentTax;
    return {
      incomeTaxMonthly: nationalTax / 12,
      reconstructionSurtaxMonthly: reconstructionSurtax / 12,
      residentTaxMonthly: residentTax / 12,
      medicareLevyMonthly: 0,
      healthInsuranceMonthly: insurance.healthInsurance / 12,
      careInsuranceMonthly: insurance.careInsurance / 12,
      childSupportMonthly: insurance.childSupport / 12,
      pensionMonthly: insurance.pension / 12,
      employmentInsuranceMonthly: insurance.employment / 12,
      totalTaxMonthly: totalTax / 12,
      totalInsuranceMonthly: totalInsurance / 12,
      totalDeductionsMonthly: (totalTax + totalInsurance) / 12,
      employerSuperMonthly: 0,
    };
  }
  if (city.taxSystem === "canada") {
    const tax = calculateCanadaTax(city, grossAnnual);
    const pension = calculateCanadaPension(grossAnnual, city.insurance);
    // ケベック州はEIの料率が低い代わりに、親保険（QPIP 0.455%、上限所得$103,000）を加えます。
    const parentalInsurance = city.taxRegion === "quebec" ? Math.min(grossAnnual, 103_000) * 0.00455 : 0;
    const employment = Math.min(grossAnnual * city.insurance.employmentRateEmployee, city.insurance.employmentCap ?? 1_123.07) + parentalInsurance;
    const totalTax = tax.federalTax + tax.provincialTax;
    const totalInsurance = pension + employment + tax.healthPremium;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: totalTax / 12, healthInsuranceMonthly: tax.healthPremium / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "us") {
    const incomeTax = calculateUsIncomeTax(city, grossAnnual);
    const socialSecurity = Math.min(grossAnnual, city.insurance.socialSecurityWageBase ?? 184_500) * city.insurance.socialSecurityRateEmployee;
    const medicare = grossAnnual * city.insurance.medicareRate + Math.max(0, grossAnnual - (city.insurance.additionalMedicareThreshold ?? 200_000)) * (city.insurance.additionalMedicareRate ?? 0);
    const health = household === "single" ? city.insurance.healthInsuranceEmployeeMonthly * 12 : city.insurance.healthInsuranceFamilyMonthly * 12;
    const statePayroll = usStatePayrollDeductions2026(city.taxRegion, grossAnnual);
    const totalTax = incomeTax + medicare;
    const totalInsurance = socialSecurity + health + statePayroll;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicare / 12, healthInsuranceMonthly: health / 12, pensionMonthly: socialSecurity / 12, employmentInsuranceMonthly: statePayroll / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "uk") {
    const allowance = grossAnnual > 100_000 ? Math.max(0, 12_570 - (grossAnnual - 100_000) / 2) : 12_570;
    const taxableIncome = Math.max(0, grossAnnual - allowance);
    // スコットランド2026-27：課税所得（個人控除後）に19/20/21/42/45/47%の6段階。国民保険は英国共通。
    const incomeTax = city.taxRegion === "scotland"
      ? taxFromAnnualBrackets(taxableIncome, [{ limit: 3_967, rate: 0.19 }, { limit: 16_956, rate: 0.2 }, { limit: 31_092, rate: 0.21 }, { limit: 62_430, rate: 0.42 }, { limit: 125_140, rate: 0.45 }, { limit: Number.POSITIVE_INFINITY, rate: 0.47 }])
      : taxFromAnnualBrackets(taxableIncome, [{ limit: 37_700, rate: 0.2 }, { limit: 125_140 - 12_570, rate: 0.4 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
    const ni = Math.max(0, Math.min(grossAnnual, 50_270) - 12_570) * 0.08 + Math.max(0, grossAnnual - 50_270) * 0.02;
    // Marriage Allowance：配偶者の収入が個人控除£12,570未満で、本人が基本税率（スコットランドは starter・basic・intermediate）の
    // 納税者なら、移転された£1,260の20%（最大£252）を本人の所得税から差し引きます（GOV.UK「Marriage Allowance」）。
    const married = isMarriedHousehold(household);
    const basicRateLimit = city.taxRegion === "scotland" ? 43_662 : 50_270;
    const marriageAllowance = married && family.spouseSalary !== undefined && family.spouseSalary < 12_570 && grossAnnual > 12_570 && grossAnnual <= basicRateLimit ? Math.min(252, incomeTax) : 0;
    const incomeTaxAfterAllowance = incomeTax - marriageAllowance;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTaxAfterAllowance / 12, employmentInsuranceMonthly: ni / 12, totalTaxMonthly: incomeTaxAfterAllowance / 12, totalInsuranceMonthly: ni / 12, totalDeductionsMonthly: (incomeTaxAfterAllowance + ni) / 12 };
  }
  if (city.taxSystem === "france") {
    const { pension, csgCrds, incomeTax } = calculateFrancePayroll(grossAnnual);
    const totalInsurance = pension + csgCrds;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: csgCrds / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "italy") {
    const { pension, nationalTax, localTax } = calculateItalyPayroll(grossAnnual, city.taxRegion);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: nationalTax / 12, residentTaxMonthly: localTax / 12, pensionMonthly: pension / 12, totalTaxMonthly: (nationalTax + localTax) / 12, totalInsuranceMonthly: pension / 12, totalDeductionsMonthly: (nationalTax + localTax + pension) / 12 };
  }
  if (city.taxSystem === "mexico") {
    const incomeTax = taxFromFixedTariff(grossAnnual, [
      { lower: 0.01, upper: 10_135.11, fixed: 0, rate: 0.0192 }, { lower: 10_135.12, upper: 86_022.11, fixed: 194.59, rate: 0.064 }, { lower: 86_022.12, upper: 151_176.19, fixed: 5_051.37, rate: 0.1088 }, { lower: 151_176.20, upper: 175_735.66, fixed: 12_140.13, rate: 0.16 }, { lower: 175_735.67, upper: 210_403.69, fixed: 16_069.64, rate: 0.1792 }, { lower: 210_403.70, upper: 424_353.97, fixed: 22_282.14, rate: 0.2136 }, { lower: 424_353.98, upper: 668_840.14, fixed: 67_981.92, rate: 0.2352 }, { lower: 668_840.15, upper: 1_276_925.98, fixed: 125_485.07, rate: 0.3 }, { lower: 1_276_925.99, upper: 1_702_567.97, fixed: 307_910.81, rate: 0.32 }, { lower: 1_702_567.98, upper: 5_107_703.92, fixed: 444_116.23, rate: 0.34 }, { lower: 5_107_703.93, upper: Number.POSITIVE_INFINITY, fixed: 1_601_862.46, rate: 0.35 },
    ]);
    const { health, pension } = calculateMexicoImssEmployee2026(grossAnnual);
    const totalInsurance = health + pension;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  const incomeTax = taxFromAnnualBrackets(grossAnnual, [{ limit: 18_200, rate: 0 }, { limit: 45_000, rate: 0.15 }, { limit: 135_000, rate: 0.3 }, { limit: 190_000, rate: 0.37 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
  const medicareLevy = grossAnnual * city.insurance.medicareRate;
  return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicareLevy / 12, totalTaxMonthly: (incomeTax + medicareLevy) / 12, totalDeductionsMonthly: (incomeTax + medicareLevy) / 12, employerSuperMonthly: grossAnnual * city.insurance.employerSuperRate / 12 };
}

export function calculateCity<TCity extends City>(city: TCity, grossAnnual: number | null, household: keyof typeof householdMultipliers, housing: keyof typeof housingMultipliers, lifestyle: keyof typeof lifestyleMultipliers, ageBand: AgeBand, options: { expatTaxRegime?: boolean; family?: Omit<JapanFamily, "singleParent"> } = {}): LegacyCityResult<TCity> {
  const householdMultiplier = householdMultipliers[household];
  const housingMultiplier = housingMultipliers[housing];
  const lifestyleMultiplier = lifestyleMultipliers[lifestyle];
  const grossMonthly = grossAnnual === null ? null : grossAnnual / 12;
  const expatTaxRegime = expatTaxRegimeStatus(city, grossAnnual, options.expatTaxRegime === true, { ...options.family, singleParent: household === "singleParent" });
  const taxBreakdown = grossAnnual === null ? null : estimateTaxBreakdown(city, grossAnnual, ageBand, household, expatTaxRegime === "applied", options.family);
  // 税制度は対応していても、公式値を確認できていない給与帯・年齢では計算不能として扱います。
  const calculationStatus = grossAnnual !== null && taxBreakdown === null ? "unavailable" : taxCalculationStatus(city);
  const calculationUnavailableReason = grossAnnual === null ? "salary" : calculationStatus === "unavailable" ? "tax" : null;
  const rent = city.costs.rent * housingMultiplier;
  const livingCosts = (city.costs.food + city.costs.utilities + city.costs.internet + city.costs.transport + city.costs.medical + city.costs.leisure) * householdMultiplier * lifestyleMultiplier;
  const totalMonthlyCosts = rent + livingCosts;
  const costIndex = Math.round((totalMonthlyCosts / (city.averageAnnualIncome / 12)) * 1000) / 10;
  const taxMonthly = taxBreakdown?.totalDeductionsMonthly ?? null;
  const netMonthly = taxMonthly === null || grossMonthly === null ? null : grossMonthly - taxMonthly;
  const monthlyRemaining = netMonthly === null ? null : netMonthly - totalMonthlyCosts;
  // 赤字は0に丸めず負値のまま返し、Offer Analyzerと同じ年間収支を示します。
  const annualSavings = monthlyRemaining === null ? null : monthlyRemaining * 12;
  const rentBurden = netMonthly === null ? null : netMonthly > 0 ? (rent / netMonthly) * 100 : 100;
  const purchasingPower = netMonthly === null ? null : netMonthly > 0 ? Math.round((netMonthly / totalMonthlyCosts) * 100) : 0;
  const savings = monthlyRemaining === null || netMonthly === null ? null : clamp((monthlyRemaining / Math.max(netMonthly * 0.4, 1)) * 100);
  const fire = savings === null ? null : clamp(savings * 0.55 + clamp(200 - costIndex, 0, 100) * 0.25 + city.scores.safety * 0.2);
  const overall = savings === null || fire === null ? null : Math.round(city.scores.livability * 0.2 + savings * 0.2 + city.scores.business * 0.15 + fire * 0.15 + city.scores.nomad * 0.1 + city.scores.family * 0.2);
  return {
    city,
    grossAnnual,
    grossMonthly,
    taxMonthly,
    netMonthly,
    rent,
    livingCosts,
    totalMonthlyCosts,
    monthlyRemaining,
    annualSavings,
    rentBurden,
    costIndex,
    purchasingPower,
    taxCalculationStatus: calculationStatus,
    calculationUnavailableReason,
    taxBreakdown,
    expatTaxRegime,
    scores: {
      livability: city.scores.livability,
      savings: savings === null ? null : Math.round(savings),
      business: city.scores.business,
      fire: fire === null ? null : Math.round(fire),
      nomad: city.scores.nomad,
      family: city.scores.family,
      overall,
    },
  };
}
