import type { CityId, CurrencyCode } from "./city";
import type { AgeBand, ExpatTaxRegimeStatus, HousingType, LifestyleType, TaxBreakdown, TaxCalculationStatus } from "./finance";

export type ScenarioHousehold = "single" | "couple";

export type ScenarioCalculationOptions = {
  ratesToJpy?: Record<CurrencyCode, number>;
  exchangeRateStatus?: "live" | "fallback";
  // 指定時は、シナリオの給与通貨と都市通貨がともに含まれる場合だけ為替を"live"として扱います。
  liveCurrencies?: CurrencyCode[];
};

export type ScenarioInput = {
  id: string;
  cityId: CityId;
  annualSalary: number;
  salaryCurrency: CurrencyCode;
  bonus?: number;
  age: number;
  householdType: ScenarioHousehold;
  children: number;
  housing: HousingType;
  lifestyle: LifestyleType;
  customRent?: number;
  customMonthlySpending?: number;
  customSavingsTarget?: number;
  currentSavings?: number;
  retirementAge?: number;
  annualReturnRate?: number;
  // 移住者向けの税の特例（オランダの30%ルールなど）の条件を満たすと本人が選んだ場合だけtrue。既定は居住者の通常税制。
  expatTaxRegime?: boolean;
};

export type ScenarioAssumptions = {
  ageBand: AgeBand;
  householdModel: "single" | "couple" | "singleParent" | "coupleOneChild" | "family" | "familyThreeChildren";
  annualReturnRate: number;
  projectionYears: [5, 10];
  calculationVersion: string;
  expatTaxRegime: ExpatTaxRegimeStatus;
};

export type FireMetrics = {
  annualLivingCost: number;
  targetWealth: number;
  yearsToTarget: number | null;
  targetAge: number | null;
  reachesBeforeRetirementAge: boolean | null;
};

export type DataConfidence = {
  score: number;
  level: "high" | "medium" | "low";
  tax: number;
  livingCost: number;
  exchangeRate: number;
  reasons: string[];
};

export type ScenarioResult = {
  scenarioId: string;
  cityId: CityId;
  currency: CurrencyCode;
  grossAnnual: number;
  grossMonthly: number;
  taxAnnual: number | null;
  socialInsuranceAnnual: number | null;
  taxBreakdown: TaxBreakdown | null;
  netAnnual: number | null;
  netMonthly: number | null;
  rentMonthly: number;
  baselineSpendingMonthly: number;
  costBreakdownMonthly: {
    source: "city-baseline" | "custom-total";
    food: number | null;
    utilities: number | null;
    internet: number | null;
    transportation: number | null;
    healthcare: number | null;
    leisure: number | null;
    customOther: number;
  };
  totalLivingCostMonthly: number;
  totalLivingCostAnnual: number;
  monthlySurplus: number | null;
  annualSavings: number | null;
  savingsRate: number | null;
  rentBurden: number | null;
  livingCostBurden: number | null;
  purchasingPowerIndex: number | null;
  annualSavingsJpy: number | null;
  netAnnualJpy: number | null;
  projectedSavings5Years: number | null;
  projectedSavings10Years: number | null;
  savingsTargetYears: number | null;
  fire: FireMetrics | null;
  dataConfidence: DataConfidence;
  calculationStatus: TaxCalculationStatus;
  unavailableReason: "tax" | "salary" | null;
  assumptions: ScenarioAssumptions;
};

export type PriorityKey = "savings" | "purchasingPower" | "qualityOfLife" | "entrepreneurship" | "fire" | "family" | "safety" | "climate" | "career" | "remoteWork";
export type UserPriorities = Record<PriorityKey, number>;

export type ScenarioScore = {
  scenarioId: string;
  eligible: boolean;
  score: number;
  rank: number;
  financialScore: number;
  lifestyleScore: number;
  preferenceScore: number;
  confidenceScore: number;
  strongestFactors: string[];
  weakestFactors: string[];
  omittedPriorities: PriorityKey[];
  riskFlags: string[];
  contributions: {
    financial: number;
    lifestyle: number;
    preference: number;
    confidence: number;
  };
};
