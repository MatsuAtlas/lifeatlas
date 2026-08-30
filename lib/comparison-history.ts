import { cities } from "../data/cities.ts";
import { FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import type { ComparisonRecord, SavedAnalyzerInput } from "../types/comparison";
import type { PriorityKey, ScenarioInput } from "../types/scenario";

export const LOCAL_HISTORY_KEY = "life-atlas-comparison-history";
export const LOCAL_HISTORY_LIMIT = 50;
const PENDING_ANALYZER_RESTORE_KEY = "life-atlas-pending-analyzer-restore";

const priorityKeys: PriorityKey[] = ["savings", "purchasingPower", "qualityOfLife", "entrepreneurship", "fire", "family", "safety", "climate", "career", "remoteWork"];
const housingTypes = new Set(["shared", "studio", "onebed", "condo", "twobed", "house"]);
const lifestyleTypes = new Set(["lean", "balanced", "comfortable"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteInRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isOptionalFiniteInRange(value: unknown, min: number, max: number) {
  return value === undefined || isFiniteInRange(value, min, max);
}

function isScenario(value: unknown): value is ScenarioInput {
  if (!isObject(value)) return false;
  return typeof value.id === "string"
    && value.id.trim().length > 0
    && typeof value.cityId === "string"
    && value.cityId in cities
    && typeof value.salaryCurrency === "string"
    && value.salaryCurrency in FALLBACK_FX_TO_JPY
    && isFiniteInRange(value.annualSalary, 0, 1_000_000_000_000)
    && isOptionalFiniteInRange(value.bonus, 0, 1_000_000_000_000)
    && isFiniteInRange(value.age, 18, 100)
    && (value.householdType === "single" || value.householdType === "couple")
    && Number.isInteger(value.children)
    && isFiniteInRange(value.children, 0, 10)
    && typeof value.housing === "string"
    && housingTypes.has(value.housing)
    && typeof value.lifestyle === "string"
    && lifestyleTypes.has(value.lifestyle)
    && isOptionalFiniteInRange(value.customRent, 0, 1_000_000_000_000)
    && isOptionalFiniteInRange(value.customMonthlySpending, 0, 1_000_000_000_000)
    && isOptionalFiniteInRange(value.customSavingsTarget, 0, 10_000_000_000_000)
    && isOptionalFiniteInRange(value.currentSavings, 0, 10_000_000_000_000)
    && isOptionalFiniteInRange(value.retirementAge, value.age as number, 100)
    && isOptionalFiniteInRange(value.annualReturnRate, -0.5, 0.5);
}

export function isComparisonRecord(value: unknown): value is ComparisonRecord {
  if (!isObject(value)) return false;
  return typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.origin_city === "string"
    && typeof value.destination_city === "string"
    && typeof value.created_at === "string"
    && isObject(value.input)
    && isObject(value.result);
}

export function isSavedAnalyzerInput(value: unknown): value is SavedAnalyzerInput {
  if (!isObject(value) || value.kind !== "offer-analyzer" || value.version !== 1) return false;
  if (!Array.isArray(value.scenarios) || value.scenarios.length < 2 || value.scenarios.length > 5 || !value.scenarios.every(isScenario)) return false;
  const scenarioIds = value.scenarios.map((scenario) => scenario.id);
  if (new Set(scenarioIds).size !== scenarioIds.length) return false;
  if (!isObject(value.priorities)) return false;
  const priorities = value.priorities;
  if (!priorityKeys.every((key) => isFiniteInRange(priorities[key], 0, 5))) return false;
  if (!isObject(value.whatIf)
    || typeof value.whatIf.scenarioId !== "string"
    || !scenarioIds.includes(value.whatIf.scenarioId)
    || !isFiniteInRange(value.whatIf.salaryPercent, -100, 1_000)
    || !isFiniteInRange(value.whatIf.rentPercent, -100, 1_000)
    || !isFiniteInRange(value.whatIf.exchangePercent, -99, 1_000)) return false;
  return isObject(value.breakEven)
    && typeof value.breakEven.candidateScenarioId === "string"
    && scenarioIds.includes(value.breakEven.candidateScenarioId)
    && (value.breakEven.metric === "disposableIncome" || value.breakEven.metric === "savingsRate" || value.breakEven.metric === "lifeAtlasScore");
}

export function readLocalHistory(): ComparisonRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(LOCAL_HISTORY_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter(isComparisonRecord).slice(0, LOCAL_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function writeLocalHistory(history: ComparisonRecord[]) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, LOCAL_HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function localHistoryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function queueAnalyzerRestore(record: ComparisonRecord) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(PENDING_ANALYZER_RESTORE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function consumeQueuedAnalyzerRestore() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_ANALYZER_RESTORE_KEY);
    window.sessionStorage.removeItem(PENDING_ANALYZER_RESTORE_KEY);
    if (!raw) return null;
    const record: unknown = JSON.parse(raw);
    return isComparisonRecord(record) && isSavedAnalyzerInput(record.input) ? record : null;
  } catch {
    return null;
  }
}
