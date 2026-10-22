import type { BreakEvenMetric, BreakEvenResult } from "./break-even";
import type { CurrencyCode } from "./city";
import type { ScenarioCalculationOptions, ScenarioHousehold, ScenarioInput, ScenarioResult, ScenarioScore, UserPriorities } from "./scenario";

type TargetedChange = { scenarioId: string };

export type WhatIfChange =
  | (TargetedChange & { type: "annualSalary"; value: number })
  | (TargetedChange & { type: "salaryPercent"; percent: number })
  | (TargetedChange & { type: "rentPercent"; percent: number })
  | (TargetedChange & { type: "household"; householdType: ScenarioHousehold })
  | (TargetedChange & { type: "children"; value: number })
  | (TargetedChange & { type: "customRent"; value: number | null })
  | (TargetedChange & { type: "customMonthlySpending"; value: number | null })
  | (TargetedChange & { type: "customSavingsTarget"; value: number | null })
  | (TargetedChange & { type: "retirementAge"; value: number })
  | (TargetedChange & { type: "annualReturnRate"; value: number })
  | { type: "exchangeRatePercent"; currency: CurrencyCode; percent: number };

export type WhatIfBreakEvenRequest = {
  referenceScenarioId: string;
  candidateScenarioId: string;
  metric: BreakEvenMetric;
};

export type WhatIfSnapshot = {
  inputs: ScenarioInput[];
  results: ScenarioResult[];
  scores: ScenarioScore[];
  breakEven: BreakEvenResult[];
};

export type WhatIfDelta = {
  scenarioId: string;
  annualSavings: number | null;
  savingsRate: number | null;
  projectedSavings10Years: number | null;
  // 変更前後のどちらかが順位の対象外（計算できない）なら、スコア・順位の変化は null（画面は —）です。
  score: number | null;
  rankChange: number | null;
  // 計算できる／できないが変わった場合の向きと、計算できない側の理由。変わらなければ null。
  rankingChange: { direction: "becameUnranked" | "becameRanked"; reason: "tax" | "salary" | "household" | null } | null;
};

export type WhatIfSimulationInput = {
  scenarios: ScenarioInput[];
  changes: WhatIfChange[];
  priorities?: UserPriorities;
  calculationOptions?: ScenarioCalculationOptions;
  breakEven?: WhatIfBreakEvenRequest[];
};

export type WhatIfSimulationResult = {
  before: WhatIfSnapshot;
  after: WhatIfSnapshot;
  deltas: WhatIfDelta[];
  appliedRatesToJpy: Record<CurrencyCode, number>;
};
