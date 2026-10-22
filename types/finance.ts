export type AgeBand = "under40" | "40to64" | "65plus";

export type TaxCalculationStatus = "official-scenario" | "official-rate-estimate" | "unavailable";

export type HouseholdType = "single" | "couple" | "singleParent" | "coupleOneChild" | "family" | "familyThreeChildren";
export type HousingType = "shared" | "studio" | "onebed" | "condo" | "twobed" | "house";
export type LifestyleType = "lean" | "balanced" | "comfortable";

export type InsuranceConfig = {
  healthRateEmployee: number;
  careRateEmployee: number;
  childSupportRateEmployee: number;
  pensionRateEmployee: number;
  employmentRateEmployee: number;
  employmentCap?: number;
  pensionBaseExemption?: number;
  pensionAnnualMax?: number;
  pensionSecondRateEmployee?: number;
  pensionSecondStart?: number;
  pensionSecondCap?: number;
  pensionSecondAnnualMax?: number;
  socialSecurityRateEmployee: number;
  socialSecurityWageBase?: number;
  additionalMedicareRate?: number;
  additionalMedicareThreshold?: number;
  medicareRate: number;
  employerSuperRate: number;
  healthInsuranceEmployeeMonthly: number;
  healthInsuranceFamilyMonthly: number;
  source: string;
};

export type TaxBreakdown = {
  incomeTaxMonthly: number;
  reconstructionSurtaxMonthly: number;
  residentTaxMonthly: number;
  medicareLevyMonthly: number;
  healthInsuranceMonthly: number;
  careInsuranceMonthly: number;
  childSupportMonthly: number;
  pensionMonthly: number;
  employmentInsuranceMonthly: number;
  totalTaxMonthly: number;
  totalInsuranceMonthly: number;
  totalDeductionsMonthly: number;
  employerSuperMonthly: number;
};

export type CalculationCity = {
  taxSystem: "japan" | "canada" | "us" | "uk" | "france" | "italy" | "mexico" | "australia" | "singapore" | "uae" | "hongKong" | "ireland" | "germany" | "thailand" | "china" | "philippines" | "vietnam" | "brazil" | "india" | "saudiArabia" | "netherlands" | "taiwan" | "indonesia" | "malaysia" | "korea" | "portugal" | "spain" | "colombia" | "argentina" | "switzerland" | "chile" | "estimate";
  taxRegion: string;
  insurance: InsuranceConfig;
  averageAnnualIncome: number;
  costs: {
    rent: number;
    food: number;
    utilities: number;
    internet: number;
    transport: number;
    medical: number;
    leisure: number;
  };
  // 家賃が光熱費込みの統計なら true（光熱費を別に足さない）。
  rentIncludesUtilities: boolean;
  scores: {
    livability: number;
    business: number;
    nomad: number;
    family: number;
    safety: number;
  };
  dataSources: Array<{ item: string; source: string }>;
};

// 家賃以外の月の生活費の内訳（世帯・生活スタイルの倍率を掛けた後）。合計は livingCosts と一致します。
// utilitiesIncludedInRent が true のとき、光熱費は住居費に含まれるため utilities は 0 です。
export type LivingCostBreakdown = {
  food: number;
  utilities: number;
  internet: number;
  transport: number;
  medical: number;
  leisure: number;
};

export type ExpatTaxRegimeStatus = "off" | "applied" | "notEligible" | "notBeneficial" | "unverified" | "notModeled";

export type LegacyCityResult<TCity extends CalculationCity> = {
  city: TCity;
  grossAnnual: number | null;
  grossMonthly: number | null;
  taxMonthly: number | null;
  netMonthly: number | null;
  rent: number;
  livingCosts: number;
  livingCostBreakdown: LivingCostBreakdown;
  utilitiesIncludedInRent: boolean;
  totalMonthlyCosts: number;
  monthlyRemaining: number | null;
  annualSavings: number | null;
  rentBurden: number | null;
  costIndex: number;
  purchasingPower: number | null;
  taxCalculationStatus: TaxCalculationStatus;
  calculationUnavailableReason: "tax" | "salary" | null;
  taxBreakdown: TaxBreakdown | null;
  expatTaxRegime: ExpatTaxRegimeStatus;
  scores: {
    livability: number;
    savings: number | null;
    business: number;
    fire: number | null;
    nomad: number;
    family: number;
    overall: number | null;
  };
};
