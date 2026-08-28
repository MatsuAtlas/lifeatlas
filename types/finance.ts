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
  taxSystem: "japan" | "canada" | "us" | "uk" | "france" | "italy" | "mexico" | "australia" | "singapore" | "uae" | "estimate";
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
  scores: {
    livability: number;
    business: number;
    nomad: number;
    family: number;
    safety: number;
  };
  dataSources: Array<{ item: string; source: string }>;
};

export type LegacyCityResult<TCity extends CalculationCity> = {
  city: TCity;
  grossAnnual: number | null;
  grossMonthly: number | null;
  taxMonthly: number | null;
  netMonthly: number | null;
  rent: number;
  livingCosts: number;
  totalMonthlyCosts: number;
  monthlyRemaining: number | null;
  annualSavings: number | null;
  rentBurden: number | null;
  costIndex: number;
  purchasingPower: number | null;
  taxCalculationStatus: TaxCalculationStatus;
  calculationUnavailableReason: "tax" | "salary" | null;
  taxBreakdown: TaxBreakdown | null;
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
