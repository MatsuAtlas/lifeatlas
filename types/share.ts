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
  // false＝計算できないため順位の対象外。古いスナップショットには無く、その場合は順位の対象です。
  ranked?: boolean;
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
  // 計算できる候補が1つもなければ null（最適候補なし）。
  winnerCityId: CityId | null;
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
