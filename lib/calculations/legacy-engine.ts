import type {
  AgeBand,
  CalculationCity as City,
  InsuranceConfig,
  LegacyCityResult,
  TaxCalculationStatus,
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

function calculateCanadaPension(grossAnnual: number, insurance: InsuranceConfig) {
  const base = Math.min(Math.max(0, grossAnnual - (insurance.pensionBaseExemption ?? 3_500)) * (insurance.pensionRateEmployee || 0.0595), insurance.pensionAnnualMax ?? 4_230.45);
  const second = Math.min(Math.max(0, grossAnnual - (insurance.pensionSecondStart ?? 74_600)), (insurance.pensionSecondCap ?? 85_000) - (insurance.pensionSecondStart ?? 74_600)) * (insurance.pensionSecondRateEmployee ?? 0.04);
  return Math.min(base, insurance.pensionAnnualMax ?? 4_230.45) + Math.min(second, insurance.pensionSecondAnnualMax ?? 416);
}

function calculateOntarioHealthPremium(taxableIncome: number) {
  if (taxableIncome <= 20_000) return 0;
  if (taxableIncome <= 36_000) return Math.min(300, (taxableIncome - 20_000) * 0.06);
  if (taxableIncome <= 48_000) return Math.min(450, 300 + (taxableIncome - 36_000) * 0.06);
  if (taxableIncome <= 72_000) return Math.min(600, 450 + (taxableIncome - 48_000) * 0.25);
  if (taxableIncome <= 200_000) return Math.min(750, 600 + (taxableIncome - 72_000) * 0.25);
  return Math.min(900, 750 + (taxableIncome - 200_000) * 0.25);
}

function calculateCanadaTax(city: City, grossAnnual: number) {
  const federalTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 16_452), [
    { limit: 58_523, rate: 0.14 }, { limit: 117_045, rate: 0.205 }, { limit: 181_440, rate: 0.26 }, { limit: 258_482, rate: 0.29 }, { limit: Number.POSITIVE_INFINITY, rate: 0.33 },
  ]);
  if (city.taxRegion === "britishColumbia") {
    const provincialTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 13_000), [
      { limit: 50_363, rate: 0.056 }, { limit: 100_728, rate: 0.077 }, { limit: 115_648, rate: 0.105 }, { limit: 140_430, rate: 0.1229 }, { limit: 190_405, rate: 0.147 }, { limit: 265_545, rate: 0.168 }, { limit: Number.POSITIVE_INFINITY, rate: 0.205 },
    ]);
    return { federalTax, provincialTax, healthPremium: 0 };
  }
  if (city.taxRegion === "quebec") {
    // ケベック州2026：連邦税は基本連邦税の16.5%を減額（Québec abatement）。州税は14/19/24/25.75%、
    // 区切り$54,345/$108,680/$132,245、基礎控除$18,952（14%の税額控除）。労働者控除などは未反映。
    const provincialTax = Math.max(0, taxFromAnnualBrackets(grossAnnual, [
      { limit: 54_345, rate: 0.14 }, { limit: 108_680, rate: 0.19 }, { limit: 132_245, rate: 0.24 }, { limit: Number.POSITIVE_INFINITY, rate: 0.2575 },
    ]) - 18_952 * 0.14);
    return { federalTax: federalTax * (1 - 0.165), provincialTax, healthPremium: 0 };
  }
  if (city.taxRegion === "alberta") {
    // 2026年：2025年の公式区切りをCRA公表の指数2.0%で調整（基礎控除$22,769は公式値と一致）。
    // 非還付控除は最低税率8%で計算します。
    const provincialTax = Math.max(0, taxFromAnnualBrackets(grossAnnual, [
      { limit: 61_200, rate: 0.08 }, { limit: 154_259, rate: 0.1 }, { limit: 185_111, rate: 0.12 }, { limit: 246_813, rate: 0.13 }, { limit: 370_220, rate: 0.14 }, { limit: Number.POSITIVE_INFINITY, rate: 0.15 },
    ]) - 22_769 * 0.08);
    return { federalTax, provincialTax, healthPremium: 0 };
  }
  const taxable = Math.max(0, grossAnnual - 12_989);
  const provincialTaxBeforeSurtax = taxFromAnnualBrackets(taxable, [
    { limit: 53_891, rate: 0.0505 }, { limit: 107_785, rate: 0.0915 }, { limit: 150_000, rate: 0.1116 }, { limit: 220_000, rate: 0.1216 }, { limit: Number.POSITIVE_INFINITY, rate: 0.1316 },
  ]);
  const surtax = provincialTaxBeforeSurtax <= 5_818 ? 0 : (provincialTaxBeforeSurtax <= 7_446 ? (provincialTaxBeforeSurtax - 5_818) * 0.2 : (provincialTaxBeforeSurtax - 5_818) * 0.2 + (provincialTaxBeforeSurtax - 7_446) * 0.36);
  return { federalTax, provincialTax: provincialTaxBeforeSurtax + surtax, healthPremium: calculateOntarioHealthPremium(Math.max(0, grossAnnual - 12_989)) };
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

// 香港・薪俸税（2026/27課税年度、2026年5月13日成立の改正後）と従業員MPF強制拠出。
// 配偶者の所得が不明なため既婚者控除は適用せず、本人の基礎控除と子ども控除だけを使います。
const HONG_KONG_BASIC_ALLOWANCE = 145_000;
const HONG_KONG_SINGLE_PARENT_ALLOWANCE = 145_000;
const HONG_KONG_CHILD_ALLOWANCE = 140_000;
const HONG_KONG_MPF_RATE = 0.05;
const HONG_KONG_MPF_MIN_MONTHLY_INCOME = 7_100;
const HONG_KONG_MPF_MAX_MONTHLY_INCOME = 30_000;
const HONG_KONG_MPF_DEDUCTION_CAP = 18_000;
const hongKongChildren = { single: 0, couple: 0, singleParent: 1, coupleOneChild: 1, family: 2, familyThreeChildren: 3 } as const;

export function calculateHongKongSalariesTax(grossAnnual: number, household: keyof typeof householdMultipliers) {
  const monthlyIncome = Math.max(0, grossAnnual) / 12;
  const mpf = monthlyIncome < HONG_KONG_MPF_MIN_MONTHLY_INCOME ? 0 : Math.min(monthlyIncome, HONG_KONG_MPF_MAX_MONTHLY_INCOME) * HONG_KONG_MPF_RATE * 12;
  const netIncome = Math.max(0, grossAnnual - Math.min(mpf, HONG_KONG_MPF_DEDUCTION_CAP));
  const allowances = HONG_KONG_BASIC_ALLOWANCE
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
// 配偶者の所得、単親控除、家賃控除などは未反映です。
const IRELAND_STANDARD_RATE_BAND = 44_000;
const IRELAND_TAX_CREDITS = 4_000;
const IRELAND_USC_EXEMPTION = 13_000;
const IRELAND_PRSI_RATE = 0.042 * 0.75 + 0.0435 * 0.25;
const IRELAND_PRSI_WEEKLY_THRESHOLD = 352;
const IRELAND_PRSI_MAX_WEEKLY_CREDIT = 12;

export function calculateIrelandPayrollTax(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const incomeTax = Math.max(0, taxFromAnnualBrackets(gross, [{ limit: IRELAND_STANDARD_RATE_BAND, rate: 0.2 }, { limit: Number.POSITIVE_INFINITY, rate: 0.4 }]) - IRELAND_TAX_CREDITS);
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

// タイ・2026課税年度（居住者・単身）。社会保険（第33条）は賃金の5%で、2026年1月から月額上限は賃金฿17,500（最大฿875）。
// 課税所得＝給与−給与所得控除（50%・上限฿100,000）−基礎控除฿60,000−社会保険料。配偶者・子どもの控除は未反映。
export function calculateThailandPayroll(grossAnnual: number) {
  const gross = Math.max(0, grossAnnual);
  const socialSecurity = Math.min(gross / 12, 17_500) * 0.05 * 12;
  const taxable = Math.max(0, gross - Math.min(gross * 0.5, 100_000) - 60_000 - socialSecurity);
  const incomeTax = taxFromAnnualBrackets(taxable, [
    { limit: 150_000, rate: 0 }, { limit: 300_000, rate: 0.05 }, { limit: 500_000, rate: 0.1 }, { limit: 750_000, rate: 0.15 },
    { limit: 1_000_000, rate: 0.2 }, { limit: 2_000_000, rate: 0.25 }, { limit: 5_000_000, rate: 0.3 }, { limit: Number.POSITIVE_INFINITY, rate: 0.35 },
  ]);
  return { incomeTax, socialSecurity };
}

// 中国・2026年（居住者の総合所得、単身）。個人所得税は3〜45%の7段階、基本控除¥60,000。
// 社会保険（従業員）：年金8%・医療2%・失業0.5%。月額の基数は都市ごとの上下限の間に収め、2026年は1〜6月を
// 2025年度、7〜12月を2026年度の上下限で按分します。北京は医療の大額互助金として月¥3を加えます。
// 住宅積立金（勤務先により5〜12%）、専項付加控除、外国人の非課税手当は未反映です。
const chinaContributionBases = {
  beijing: [{ months: 6, lower: 7_162, upper: 35_811 }, { months: 6, lower: 7_270, upper: 36_348 }],
  shanghai: [{ months: 6, lower: 7_460, upper: 37_302 }, { months: 6, lower: 7_546, upper: 37_731 }],
} as const;

export function calculateChinaPayroll(grossAnnual: number, region: keyof typeof chinaContributionBases) {
  const monthly = Math.max(0, grossAnnual) / 12;
  const socialInsurance = chinaContributionBases[region].reduce((total, period) => {
    const base = Math.min(Math.max(monthly, period.lower), period.upper);
    return total + (base * (0.08 + 0.02 + 0.005) + (region === "beijing" ? 3 : 0)) * period.months;
  }, 0);
  const incomeTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 60_000 - socialInsurance), [
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
// 失業1%（上限は地域I最低賃金₫5.31百万の20倍）。扶養控除と外国人の失業保険対象外は未反映です。
export function calculateVietnamPayroll(grossAnnual: number) {
  const monthly = Math.max(0, grossAnnual) / 12;
  let incomeTax = 0;
  let socialInsurance = 0;
  for (const cap of [46_800_000, 50_600_000]) {
    const insurance = Math.min(monthly, cap) * 0.095 + Math.min(monthly, 106_200_000) * 0.01;
    const tax = taxFromAnnualBrackets(Math.max(0, monthly - insurance - 15_500_000), [
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

export function taxCalculationStatus(city: City): TaxCalculationStatus {
  if (city.taxSystem === "estimate") return "unavailable";
  if (city.taxSystem === "china" && !["beijing", "shanghai"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "canada" && !["britishColumbia", "ontario", "alberta", "quebec"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "us" && !["california", "newYork", "texas", "florida", "washington", "massachusetts", "illinois", "districtOfColumbia"].includes(city.taxRegion)) return "unavailable";
  if (["singapore", "uae"].includes(city.taxSystem)) return "official-scenario";
  return "official-rate-estimate";
}

export function officialSalaryBenchmarkSource<TCity extends City>(city: TCity): TCity["dataSources"][number] | null {
  const salarySource = city.dataSources.find((item) => item.item.startsWith("給与"));
  if (!salarySource || /Life Atlas|推定|保存参考値/.test(salarySource.source)) return null;
  return salarySource;
}

function estimateTaxBreakdown(city: City, grossAnnual: number, ageBand: AgeBand, household: keyof typeof householdMultipliers) {
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
  if (city.taxSystem === "uae") return emptyTaxBreakdown();
  if (city.taxSystem === "china" && (city.taxRegion === "beijing" || city.taxRegion === "shanghai")) {
    const { incomeTax, socialInsurance } = calculateChinaPayroll(grossAnnual, city.taxRegion);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "indonesia") {
    const { incomeTax, pension, health } = calculateIndonesiaPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: (pension + health) / 12, totalDeductionsMonthly: (incomeTax + pension + health) / 12 };
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
    const { incomeTax, socialInsurance } = calculateVietnamPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "philippines") {
    const { incomeTax, socialInsurance } = calculatePhilippinesPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialInsurance / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialInsurance / 12, totalDeductionsMonthly: (incomeTax + socialInsurance) / 12 };
  }
  if (city.taxSystem === "thailand") {
    const { incomeTax, socialSecurity } = calculateThailandPayroll(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: socialSecurity / 12, totalDeductionsMonthly: (incomeTax + socialSecurity) / 12 };
  }
  if (city.taxSystem === "germany") {
    const { incomeTax, solidarity, pension, unemployment, health, care } = calculateGermanyPayroll(grossAnnual, household);
    const totalTax = incomeTax + solidarity;
    const totalInsurance = pension + unemployment + health + care;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, reconstructionSurtaxMonthly: solidarity / 12, healthInsuranceMonthly: health / 12, careInsuranceMonthly: care / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: unemployment / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "ireland") {
    const { incomeTax, usc, prsi } = calculateIrelandPayrollTax(grossAnnual);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, residentTaxMonthly: usc / 12, pensionMonthly: prsi / 12, totalTaxMonthly: (incomeTax + usc) / 12, totalInsuranceMonthly: prsi / 12, totalDeductionsMonthly: (incomeTax + usc + prsi) / 12 };
  }
  if (city.taxSystem === "hongKong") {
    const { salariesTax, mpf } = calculateHongKongSalariesTax(grossAnnual, household);
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: salariesTax / 12, pensionMonthly: mpf / 12, totalTaxMonthly: salariesTax / 12, totalInsuranceMonthly: mpf / 12, totalDeductionsMonthly: (salariesTax + mpf) / 12 };
  }
  if (city.taxSystem === "japan") {
    const insurance = calculateJapanInsurance(city, grossAnnual, ageBand);
    const totalInsurance = insurance.healthInsurance + insurance.childSupport + insurance.careInsurance + insurance.pension + insurance.employment;
    const salaryIncome = Math.max(0, grossAnnual - japaneseSalaryDeduction(grossAnnual));
    const taxableIncome = Math.floor(Math.max(0, salaryIncome - japaneseBasicDeduction(grossAnnual) - totalInsurance) / 1_000) * 1_000;
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
    const residentTaxBase = Math.max(0, salaryIncome - 430_000 - totalInsurance);
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
    const totalTax = incomeTax + medicare;
    const totalInsurance = socialSecurity + health;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicare / 12, healthInsuranceMonthly: health / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "uk") {
    const allowance = grossAnnual > 100_000 ? Math.max(0, 12_570 - (grossAnnual - 100_000) / 2) : 12_570;
    const taxableIncome = Math.max(0, grossAnnual - allowance);
    const incomeTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 37_700, rate: 0.2 }, { limit: 125_140 - 12_570, rate: 0.4 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
    const ni = Math.max(0, Math.min(grossAnnual, 50_270) - 12_570) * 0.08 + Math.max(0, grossAnnual - 50_270) * 0.02;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, employmentInsuranceMonthly: ni / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: ni / 12, totalDeductionsMonthly: (incomeTax + ni) / 12 };
  }
  if (city.taxSystem === "france") {
    const socialBase = grossAnnual;
    const health = socialBase * city.insurance.healthRateEmployee;
    const pension = socialBase * city.insurance.pensionRateEmployee;
    const employment = socialBase * city.insurance.employmentRateEmployee;
    const taxableIncome = socialBase * 0.9;
    const incomeTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 11_600, rate: 0 }, { limit: 29_579, rate: 0.11 }, { limit: 84_577, rate: 0.3 }, { limit: 181_917, rate: 0.41 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
    const totalInsurance = health + pension + employment;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "italy") {
    const pension = grossAnnual * city.insurance.pensionRateEmployee + Math.min(Math.max(0, grossAnnual - 56_224), 66_071) * 0.01;
    const taxableIncome = Math.max(0, grossAnnual - pension);
    const nationalTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 15_000, rate: 0.23 }, { limit: 28_000, rate: 0.33 }, { limit: Number.POSITIVE_INFINITY, rate: 0.43 }]);
    const localTax = taxableIncome * 0.0263;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: nationalTax / 12, residentTaxMonthly: localTax / 12, pensionMonthly: pension / 12, totalTaxMonthly: (nationalTax + localTax) / 12, totalInsuranceMonthly: pension / 12, totalDeductionsMonthly: (nationalTax + localTax + pension) / 12 };
  }
  if (city.taxSystem === "mexico") {
    const incomeTax = taxFromFixedTariff(grossAnnual, [
      { lower: 0.01, upper: 10_135.11, fixed: 0, rate: 0.0192 }, { lower: 10_135.12, upper: 86_022.11, fixed: 194.59, rate: 0.064 }, { lower: 86_022.12, upper: 151_176.19, fixed: 5_051.37, rate: 0.1088 }, { lower: 151_176.20, upper: 175_735.66, fixed: 12_140.13, rate: 0.16 }, { lower: 175_735.67, upper: 210_403.69, fixed: 16_069.64, rate: 0.1792 }, { lower: 210_403.70, upper: 424_353.97, fixed: 22_282.14, rate: 0.2136 }, { lower: 424_353.98, upper: 668_840.14, fixed: 67_981.92, rate: 0.2352 }, { lower: 668_840.15, upper: 1_276_925.98, fixed: 125_485.07, rate: 0.3 }, { lower: 1_276_925.99, upper: 1_702_567.97, fixed: 307_910.81, rate: 0.32 }, { lower: 1_702_567.98, upper: 5_107_703.92, fixed: 444_116.23, rate: 0.34 }, { lower: 5_107_703.93, upper: Number.POSITIVE_INFINITY, fixed: 1_601_862.46, rate: 0.35 },
    ]);
    const health = grossAnnual * city.insurance.healthRateEmployee;
    const pension = grossAnnual * city.insurance.pensionRateEmployee;
    const totalInsurance = health + pension;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  const incomeTax = taxFromAnnualBrackets(grossAnnual, [{ limit: 18_200, rate: 0 }, { limit: 45_000, rate: 0.15 }, { limit: 135_000, rate: 0.3 }, { limit: 190_000, rate: 0.37 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
  const medicareLevy = grossAnnual * city.insurance.medicareRate;
  return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicareLevy / 12, totalTaxMonthly: (incomeTax + medicareLevy) / 12, totalDeductionsMonthly: (incomeTax + medicareLevy) / 12, employerSuperMonthly: grossAnnual * city.insurance.employerSuperRate / 12 };
}

export function calculateCity<TCity extends City>(city: TCity, grossAnnual: number | null, household: keyof typeof householdMultipliers, housing: keyof typeof housingMultipliers, lifestyle: keyof typeof lifestyleMultipliers, ageBand: AgeBand): LegacyCityResult<TCity> {
  const householdMultiplier = householdMultipliers[household];
  const housingMultiplier = housingMultipliers[housing];
  const lifestyleMultiplier = lifestyleMultipliers[lifestyle];
  const grossMonthly = grossAnnual === null ? null : grossAnnual / 12;
  const calculationStatus = taxCalculationStatus(city);
  const calculationUnavailableReason = grossAnnual === null ? "salary" : calculationStatus === "unavailable" ? "tax" : null;
  const taxBreakdown = grossAnnual === null ? null : estimateTaxBreakdown(city, grossAnnual, ageBand, household);
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
