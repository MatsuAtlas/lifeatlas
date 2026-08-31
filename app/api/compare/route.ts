import { NextResponse } from "next/server";

import { isRecord, parseSameOriginJson } from "../../../lib/api/json-request";
import { calculateScenario } from "../../../lib/calculations/calculate-scenario";
import { isScenarioInput, isUserPriorities } from "../../../lib/comparison-history";
import { logOperationsEvent } from "../../../lib/observability/operations";
import { scoreScenarios } from "../../../lib/scoring/life-atlas-score";

export async function POST(request: Request) {
  const parsed = await parseSameOriginJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value) || !Array.isArray(parsed.value.scenarios) || parsed.value.scenarios.length < 2 || parsed.value.scenarios.length > 5 || !parsed.value.scenarios.every(isScenarioInput) || !isUserPriorities(parsed.value.priorities)) {
    return NextResponse.json({ error: "2〜5件の比較条件と優先軸を確認してください。" }, { status: 400 });
  }
  const scenarios = parsed.value.scenarios;
  if (new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length) return NextResponse.json({ error: "比較IDは重複できません。" }, { status: 400 });
  try {
    const results = scenarios.map((scenario) => calculateScenario(scenario));
    for (const result of results) {
      if (result.calculationStatus === "unavailable") logOperationsEvent("warn", "missing_city_data", { endpoint: "compare", cityId: result.cityId, reason: result.unavailableReason });
    }
    return NextResponse.json({ results, scores: scoreScenarios(results, parsed.value.priorities) });
  } catch (error) {
    logOperationsEvent("error", "calculation_failed", { endpoint: "compare", errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "比較を完了できませんでした。" }, { status: 422 });
  }
}
