import type { BreakEvenMetric } from "./break-even";
import type { CityId, CurrencyCode } from "./city";
import type { TaxCalculationStatus } from "./finance";
import type { PriorityKey, UserPriorities } from "./scenario";

export type RecommendationLanguage = "ja" | "en";

export type RecommendationScenario = {
  scenarioId: string;
  cityId: CityId;
  cityName: string;
  country: string;
  salary: { annual: number; currency: CurrencyCode };
  household: { type: "single" | "couple"; children: number; housing: string; lifestyle: string };
  rank: number;
  lifeAtlasScore: number;
  calculationStatus: TaxCalculationStatus;
  financials: {
    grossAnnual: number;
    netAnnual: number | null;
    totalLivingCostMonthly: number;
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
