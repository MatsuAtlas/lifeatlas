import { NextResponse } from "next/server";

import { calculateScenario } from "../../../lib/calculations/calculate-scenario";
import { isScenarioInput } from "../../../lib/comparison-history";
import { isRecord, parseSameOriginJson } from "../../../lib/api/json-request";
import { logOperationsEvent } from "../../../lib/observability/operations";

export async function POST(request: Request) {
  const parsed = await parseSameOriginJson(request);
  if (!parsed.ok) return parsed.response;
  const scenario = isRecord(parsed.value) ? parsed.value.scenario : null;
  if (!isScenarioInput(scenario)) {
    const cityId = isRecord(scenario) && typeof scenario.cityId === "string" ? scenario.cityId : null;
    if (cityId) logOperationsEvent("warn", "missing_city_data", { endpoint: "calculate", cityId });
    return NextResponse.json({ error: "計算条件を確認してください。" }, { status: 400 });
  }
  try {
    const result = calculateScenario(scenario);
    if (result.calculationStatus === "unavailable") {
      logOperationsEvent("warn", "missing_city_data", { endpoint: "calculate", cityId: result.cityId, reason: result.unavailableReason });
    }
    return NextResponse.json({ result });
  } catch (error) {
    logOperationsEvent("error", "calculation_failed", { endpoint: "calculate", cityId: scenario.cityId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "計算を完了できませんでした。" }, { status: 422 });
  }
}
