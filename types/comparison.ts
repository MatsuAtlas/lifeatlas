import type { BreakEvenMetric } from "./break-even";
import type { ScenarioInput, UserPriorities } from "./scenario";
import type { WhatIfDelta, WhatIfSnapshot } from "./what-if";

export type ComparisonRecord = {
  id: string;
  title: string;
  origin_city: string;
  destination_city: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export type SavedAnalyzerInput = {
  kind: "offer-analyzer";
  version: 1;
  scenarios: ScenarioInput[];
  priorities: UserPriorities;
  whatIf: {
    scenarioId: string;
    salaryPercent: number;
    rentPercent: number;
    exchangePercent: number;
  };
  breakEven: {
    candidateScenarioId: string;
    metric: BreakEvenMetric;
  };
};

export type SavedAnalyzerResult = {
  kind: "offer-analyzer";
  version: 1;
  calculatedAt: string;
  snapshot: WhatIfSnapshot;
  deltas: WhatIfDelta[];
};
