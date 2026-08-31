import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isSupabaseNotConfiguredError,
  supabaseRestRequest,
} from "../../../lib/supabase-server";
import { billingResponse, readBillingRecord } from "../../../lib/billing/subscription-server";
import { isSavedAnalyzerInput } from "../../../lib/comparison-history";

export const dynamic = "force-dynamic";

const HISTORY_COLUMNS = "id,title,origin_city,destination_city,input,result,created_at";
const HISTORY_LIMIT = 50;
const MAX_BODY_LENGTH = 64_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CITY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type ComparisonPayload = {
  title: string;
  origin_city: string;
  destination_city: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown): ComparisonPayload | null {
  if (!isObject(value)) return null;
  const { title, origin_city: originCity, destination_city: destinationCity, input, result } = value;
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 120) return null;
  if (typeof originCity !== "string" || !CITY_PATTERN.test(originCity)) return null;
  if (typeof destinationCity !== "string" || !CITY_PATTERN.test(destinationCity)) return null;
  if (!isObject(input) || !isObject(result)) return null;
  return {
    title: title.trim(),
    origin_city: originCity,
    destination_city: destinationCity,
    input,
    result,
  };
}

async function requireUser() {
  const current = await getCurrentUser();
  if (!current) return null;
  return current;
}

function unavailableResponse(error: unknown) {
  if (isSupabaseNotConfiguredError(error)) {
    return NextResponse.json(
      { error: "Supabaseの接続設定がまだありません。", configured: false },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "比較履歴を処理できませんでした。" }, { status: 500 });
}

export async function GET() {
  try {
    const current = await requireUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    if (!UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "ユーザー情報を確認できませんでした。" }, { status: 401 });

    const query = `comparison_history?select=${HISTORY_COLUMNS}&user_id=eq.${encodeURIComponent(current.user.id)}&order=created_at.desc&limit=${HISTORY_LIMIT}`;
    const response = await supabaseRestRequest(query, {}, current.accessToken);
    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 401 ? "ログインし直してください。" : "比較履歴を取得できませんでした。" },
        { status: response.status === 401 ? 401 : 502 },
      );
    }

    const history = await response.json();
    return NextResponse.json({ history: Array.isArray(history) ? history : [] });
  } catch (error) {
    return unavailableResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "保存内容の形式が正しくありません。" }, { status: 415 });
    const current = await requireUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    if (!UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "ユーザー情報を確認できませんでした。" }, { status: 401 });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: "保存内容が大きすぎます。" }, { status: 413 });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "保存内容が大きすぎます。" }, { status: 413 });

    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "保存内容の形式が正しくありません。" }, { status: 400 });
    }

    const payload = parsePayload(input);
    if (!payload) return NextResponse.json({ error: "保存内容の形式が正しくありません。" }, { status: 400 });

    const billing = billingResponse(await readBillingRecord(current.user.id, current.accessToken), true);
    if (isSavedAnalyzerInput(payload.input) && payload.input.scenarios.length > billing.entitlements.maxScenarios) {
      return NextResponse.json({ error: "3件以上のOffer Analyzer分析を保存するにはProが必要です。", upgradeRequired: true }, { status: 403 });
    }
    if (billing.entitlements.maxSavedComparisons !== null) {
      const existingResponse = await supabaseRestRequest(
        `comparison_history?select=id&user_id=eq.${encodeURIComponent(current.user.id)}&limit=${billing.entitlements.maxSavedComparisons}`,
        {},
        current.accessToken,
      );
      if (!existingResponse.ok) return NextResponse.json({ error: "保存件数を確認できませんでした。" }, { status: 502 });
      const existing: unknown = await existingResponse.json();
      if (Array.isArray(existing) && existing.length >= billing.entitlements.maxSavedComparisons) {
        return NextResponse.json({ error: "Freeプランの保存上限は1件です。Proでは無制限に保存できます。", upgradeRequired: true }, { status: 403 });
      }
    }

    const response = await supabaseRestRequest(
      `comparison_history?select=${HISTORY_COLUMNS}`,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ user_id: current.user.id, ...payload }),
      },
      current.accessToken,
    );
    if (!response.ok) {
      return NextResponse.json({ error: "比較履歴を保存できませんでした。" }, { status: 502 });
    }

    const records = await response.json();
    const record = Array.isArray(records) ? records[0] : null;
    if (!record) return NextResponse.json({ error: "保存結果を確認できませんでした。" }, { status: 502 });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return unavailableResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    const current = await requireUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    if (!UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "ユーザー情報を確認できませんでした。" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id || !UUID_PATTERN.test(id)) return NextResponse.json({ error: "履歴IDが正しくありません。" }, { status: 400 });

    const query = `comparison_history?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(current.user.id)}`;
    const response = await supabaseRestRequest(
      query,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
      current.accessToken,
    );
    if (!response.ok) return NextResponse.json({ error: "比較履歴を削除できませんでした。" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailableResponse(error);
  }
}
