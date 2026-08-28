import type { CityId, CurrencyCode } from "./city";
import type { AgeBand, HousingType, LifestyleType, TaxBreakdown, TaxCalculationStatus } from "./finance";

export type ScenarioHousehold = "single" | "couple";

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
};

export type ScenarioAssumptions = {
  ageBand: AgeBand;
  householdModel: "single" | "couple" | "singleParent" | "coupleOneChild" | "family" | "familyThreeChildren";
  annualReturnRate: number;
  projectionYears: [5, 10];
  calculationVersion: string;
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
  score: number;
  rank: number;
  financialScore: number;
  lifestyleScore: number;
  preferenceScore: number;
  confidenceScore: number;
  strongestFactors: string[];
  weakestFactors: string[];
  omittedPriorities: PriorityKey[];
};
