import type { CurrencyCode } from "./city";
import type { ScenarioCalculationOptions, ScenarioInput, UserPriorities } from "./scenario";

export type BreakEvenMetric = "disposableIncome" | "savingsRate" | "lifeAtlasScore";

export type BreakEvenResult = {
  status: "matched" | "unreachable" | "calculation-unavailable";
  metric: BreakEvenMetric;
  referenceScenarioId: string;
  candidateScenarioId: string;
  requiredAnnualSalary: number | null;
  salaryCurrency: CurrencyCode;
  fixedBonus: number;
  referenceValue: number | null;
  achievedValue: number | null;
  iterations: number;
};

export type BreakEvenInput = {
  reference: ScenarioInput;
  candidate: ScenarioInput;
  metric: BreakEvenMetric;
  priorities?: UserPriorities;
  calculationOptions?: ScenarioCalculationOptions;
  maxAnnualSalary?: number;
  salaryTolerance?: number;
};
