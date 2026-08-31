import { NextResponse } from "next/server";

import { isRecord, parseSameOriginJson } from "../../../lib/api/json-request";
import { findBreakEvenSalary } from "../../../lib/calculations/break-even";
import { isScenarioInput, isUserPriorities } from "../../../lib/comparison-history";
import { logOperationsEvent } from "../../../lib/observability/operations";
import type { BreakEvenMetric } from "../../../types/break-even";

const metrics = new Set<BreakEvenMetric>(["disposableIncome", "savingsRate", "lifeAtlasScore"]);

export async function POST(request: Request) {
  const parsed = await parseSameOriginJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value) || !isScenarioInput(parsed.value.reference) || !isScenarioInput(parsed.value.candidate) || typeof parsed.value.metric !== "string" || !metrics.has(parsed.value.metric as BreakEvenMetric) || (parsed.value.priorities !== undefined && !isUserPriorities(parsed.value.priorities))) {
    return NextResponse.json({ error: "逆転給与の条件を確認してください。" }, { status: 400 });
  }
  try {
    const result = findBreakEvenSalary({
      reference: parsed.value.reference,
      candidate: parsed.value.candidate,
      metric: parsed.value.metric as BreakEvenMetric,
      priorities: parsed.value.priorities,
    });
    if (result.status === "calculation-unavailable") logOperationsEvent("warn", "missing_city_data", { endpoint: "break-even", cityId: parsed.value.candidate.cityId });
    return NextResponse.json({ result });
  } catch (error) {
    logOperationsEvent("error", "calculation_failed", { endpoint: "break-even", cityId: parsed.value.candidate.cityId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "逆転給与を計算できませんでした。" }, { status: 422 });
  }
}
