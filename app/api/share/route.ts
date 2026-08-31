import { NextResponse } from "next/server";

import { entitlementsForTier } from "../../../lib/billing/entitlements";
import { readBillingRecord } from "../../../lib/billing/subscription-server";
import { isSavedAnalyzerInput } from "../../../lib/comparison-history";
import { createPublicShareSnapshot } from "../../../lib/share/snapshot";
import { savePublicShare } from "../../../lib/share/server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 48_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) return NextResponse.json({ error: "共有内容が大きすぎます。" }, { status: 413 });
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "共有内容が大きすぎます。" }, { status: 413 });
    const body: unknown = JSON.parse(text);
    if (!isObject(body) || !isSavedAnalyzerInput(body.analysis) || (body.language !== "ja" && body.language !== "en")) {
      return NextResponse.json({ error: "共有内容を確認できませんでした。" }, { status: 400 });
    }

    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "共有リンクを作るにはログインしてください。" }, { status: 401 });
    const billing = await readBillingRecord(current.user.id, current.accessToken);
    const entitlements = entitlementsForTier(billing?.status === "active" || billing?.status === "trialing" ? "pro" : "free");
    if (!entitlements.canShareResults) return NextResponse.json({ error: "公開共有リンクはProで利用できます。", upgradeRequired: true }, { status: 403 });
    if (body.analysis.scenarios.length > entitlements.maxScenarios) return NextResponse.json({ error: "共有できるシナリオ数を超えています。" }, { status: 400 });

    const id = await savePublicShare(current.user.id, createPublicShareSnapshot(body.analysis, body.language));
    return NextResponse.json({ id, path: `/share/${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "共有内容を確認できませんでした。" }, { status: 400 });
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "公開共有は現在準備中です。", configured: false }, { status: 503 });
    console.error(JSON.stringify({ event: "public_share_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "公開共有リンクを作成できませんでした。" }, { status: 502 });
  }
}
