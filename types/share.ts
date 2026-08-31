import type { CityId, CurrencyCode } from "./city";
import type { SupportedLanguage } from "../lib/cities/localization";
import type { DataConfidence, ScenarioResult } from "./scenario";

export type PublicShareScenario = {
  cityId: CityId;
  rank: number;
  score: number;
  currency: CurrencyCode;
  grossAnnual: number;
  netAnnual: number | null;
  totalLivingCostMonthly: number;
  annualSavings: number | null;
  savingsRate: number | null;
  rentBurden: number | null;
  dataConfidence: DataConfidence;
  calculationStatus: ScenarioResult["calculationStatus"];
  strongestFactors: string[];
  riskFlags: string[];
};

export type PublicShareSnapshot = {
  version: 1;
  title: string;
  language: SupportedLanguage;
  calculationVersion: string;
  calculatedAt: string;
  winnerCityId: CityId;
  explanation: string;
  scenarios: PublicShareScenario[];
};

export type PublicShareRecord = {
  id: string;
  title: string;
  language: SupportedLanguage;
  snapshot: PublicShareSnapshot;
  created_at: string;
};
