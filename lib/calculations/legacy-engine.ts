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
  return federalTax;
}

export function taxCalculationStatus(city: City): TaxCalculationStatus {
  if (city.taxSystem === "estimate") return "unavailable";
  if (city.taxSystem === "canada" && !["britishColumbia", "ontario"].includes(city.taxRegion)) return "unavailable";
  if (city.taxSystem === "us" && !["california", "newYork", "texas", "florida", "washington"].includes(city.taxRegion)) return "unavailable";
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
    const employment = Math.min(grossAnnual * city.insurance.employmentRateEmployee, city.insurance.employmentCap ?? 1_123.07);
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
  const annualSavings = monthlyRemaining === null ? null : Math.max(monthlyRemaining, 0) * 12;
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
