import { NextResponse } from "next/server";

import { isRecord, parseSameOriginJson } from "../../../lib/api/json-request";
import { canUseBreakEven } from "../../../lib/billing/entitlements";
import { billingResponse, readBillingRecord } from "../../../lib/billing/subscription-server";
import { findBreakEvenSalary } from "../../../lib/calculations/break-even";
import { isScenarioInput, isUserPriorities } from "../../../lib/comparison-history";
import { calculationOptionsFor, getExchangeRateSnapshot } from "../../../lib/data/exchange-rates";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../lib/supabase-server";
import { logOperationsEvent } from "../../../lib/observability/operations";
import type { BreakEvenMetric } from "../../../types/break-even";

const metrics = new Set<BreakEvenMetric>(["disposableIncome", "savingsRate", "lifeAtlasScore"]);

// 逆転給与はPro機能のため、APIでもサーバー側で契約状態を確認します。
async function breakEvenAccessError() {
  try {
    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "逆転給与を利用するにはログインしてください。" }, { status: 401 });
    const billing = billingResponse(await readBillingRecord(current.user.id, current.accessToken), true);
    if (!canUseBreakEven(billing.entitlements)) return NextResponse.json({ error: "逆転給与はProで利用できます。", upgradeRequired: true }, { status: 403 });
    return null;
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "アカウント機能が未設定のため、逆転給与APIは利用できません。" }, { status: 503 });
    return NextResponse.json({ error: "契約状態を確認できませんでした。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const parsed = await parseSameOriginJson(request);
  if (!parsed.ok) return parsed.response;
  const accessError = await breakEvenAccessError();
  if (accessError) return accessError;
  if (!isRecord(parsed.value) || !isScenarioInput(parsed.value.reference) || !isScenarioInput(parsed.value.candidate) || typeof parsed.value.metric !== "string" || !metrics.has(parsed.value.metric as BreakEvenMetric) || (parsed.value.priorities !== undefined && !isUserPriorities(parsed.value.priorities))) {
    return NextResponse.json({ error: "逆転給与の条件を確認してください。" }, { status: 400 });
  }
  try {
    const result = findBreakEvenSalary({
      reference: parsed.value.reference,
      candidate: parsed.value.candidate,
      metric: parsed.value.metric as BreakEvenMetric,
      priorities: parsed.value.priorities,
      calculationOptions: calculationOptionsFor(await getExchangeRateSnapshot()),
    });
    if (result.status === "calculation-unavailable") logOperationsEvent("warn", "missing_city_data", { endpoint: "break-even", cityId: parsed.value.candidate.cityId });
    return NextResponse.json({ result });
  } catch (error) {
    logOperationsEvent("error", "calculation_failed", { endpoint: "break-even", cityId: parsed.value.candidate.cityId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "逆転給与を計算できませんでした。" }, { status: 422 });
  }
}
