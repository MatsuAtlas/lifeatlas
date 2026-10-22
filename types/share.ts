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
  // 古いスナップショットには無いため任意項目です。
  expatTaxRegime?: ScenarioResult["assumptions"]["expatTaxRegime"];
  // 収支の基準（夫婦は世帯）。2026.10-v2.3 より前のスナップショットには無いため任意項目です。
  cashflowBasis?: ScenarioResult["cashflow"]["basis"];
  householdNetAnnual?: number | null;
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
