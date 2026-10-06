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
  // 家族の人的控除用（任意）。配偶者の給与年収は給与と同じ通貨で、夫婦世帯の場合だけ使います。
  // 子どもの年齢は12月31日時点で、人数分まで。現在は日本の都市の税計算に使います。
  spouseAnnualSalary?: number;
  childrenAges?: number[];
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

// 主な就労ビザの給与基準との比較（lib/calculations/work-visa.ts）。給与以外の条件は判定しません。
export type WorkVisaSalaryCheck = {
  countryCode: string;
  route: { ja: string; en: string };
  currency: CurrencyCode;
  annualThreshold: number;
  status: "meets" | "below" | "check";
  // check の理由：賞与を含めた場合だけ満たす（bonus）／休暇手当を含むかで結果が変わる（holidayAllowance）
  reason: "bonus" | "holidayAllowance" | null;
  meetsReducedThreshold: boolean | null;
  reduced: { annual: number; condition: { ja: string; en: string } } | null;
  source: { name: string; url: string; period: string };
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
  workVisaSalary: WorkVisaSalaryCheck | null;
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
