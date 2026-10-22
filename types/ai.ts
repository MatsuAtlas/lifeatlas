import type { BreakEvenMetric } from "./break-even";
import type { CityId, CurrencyCode } from "./city";
import type { ExpatTaxRegimeStatus, TaxCalculationStatus } from "./finance";
import type { PriorityKey, UserPriorities } from "./scenario";

export type RecommendationLanguage = "ja" | "en";

export type RecommendationScenario = {
  scenarioId: string;
  cityId: CityId;
  cityName: string;
  country: string;
  salary: { annual: number; currency: CurrencyCode };
  household: { type: "single" | "couple"; children: number; housing: string; lifestyle: string };
  // 順位の対象外（計算できない候補）は null。ranked で区別します。
  rank: number | null;
  ranked: boolean;
  lifeAtlasScore: number;
  calculationStatus: TaxCalculationStatus;
  expatTaxRegime: ExpatTaxRegimeStatus;
  workVisaSalary: { route: string; status: "meets" | "below" | "check"; annualThreshold: number; currency: CurrencyCode } | null;
  financials: {
    grossAnnual: number;
    netAnnual: number | null;
    // 収支の基準（individual＝本人、household＝世帯）と世帯の手取り。残額・貯蓄はこの基準で計算済みです。
    cashflowBasis: "individual" | "household";
    householdNetAnnual: number | null;
    householdCashflowUnavailable: "spouseIncomeUnknown" | "householdModelUnsupported" | null;
    totalLivingCostMonthly: number;
    utilitiesBasis: "separate" | "includedInRent" | "customRentUnconfirmed" | "inCustomTotal";
    annualSavings: number | null;
    savingsRate: number | null;
    projectedSavings5Years: number | null;
    projectedSavings10Years: number | null;
    fireYearsToTarget: number | null;
    currency: CurrencyCode;
  };
  dataConfidence: { level: "high" | "medium" | "low"; score: number; reasons: string[] };
  omittedPriorities: PriorityKey[];
  riskFlags: string[];
  dataScope: { updatedAt: string; sourceLabel: string };
};

export type RecommendationInput = {
  version: 1;
  language: RecommendationLanguage;
  userPriorities: UserPriorities;
  winnerScenarioId: string;
  scenarios: RecommendationScenario[];
  breakEvenResults: Array<{
    candidateScenarioId: string;
    referenceScenarioId: string;
    metric: BreakEvenMetric;
    status: string;
    requiredAnnualSalary: number | null;
    salaryCurrency: CurrencyCode;
  }>;
  whatIfApplied: boolean;
  followUpQuestion?: string;
};

export type AIRecommendation = {
  winnerScenarioId: string;
  executiveSummary: string;
  reasons: Array<{ title: string; explanation: string }>;
  tradeoffs: Array<{ scenarioId: string; advantages: string[]; disadvantages: string[] }>;
  risks: string[];
  nextQuestions: string[];
};

export type AIUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type RecommendationGeneration = {
  id: string;
  recommendation: AIRecommendation;
  model: string;
  cached: boolean;
  createdAt: string;
  usage: AIUsage;
};
