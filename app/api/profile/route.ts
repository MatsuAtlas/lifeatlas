import { NextResponse } from "next/server";

import { getCurrentUser, isSupabaseNotConfiguredError, supabaseRestRequest } from "../../../lib/supabase-server";
import { isUserProfile, profileFromRow } from "../../../lib/user-profile";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 16_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_COLUMNS = "age,household_type,children,base_currency,current_city,priorities,updated_at";

function unavailable(error: unknown) {
  if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "Supabaseの接続設定がまだありません。", configured: false }, { status: 503 });
  return NextResponse.json({ error: "プロフィールを処理できませんでした。" }, { status: 500 });
}

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current || !UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    const response = await supabaseRestRequest(`user_profiles?select=${PROFILE_COLUMNS}&user_id=eq.${encodeURIComponent(current.user.id)}&limit=1`, {}, current.accessToken);
    if (!response.ok) return NextResponse.json({ error: "プロフィールを取得できませんでした。" }, { status: 502 });
    const rows: unknown = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return NextResponse.json({ profile: row ? profileFromRow(row) : null });
  } catch (error) {
    return unavailable(error);
  }
}

export async function PUT(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "更新内容の形式が正しくありません。" }, { status: 415 });
    const current = await getCurrentUser();
    if (!current || !UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) return NextResponse.json({ error: "更新内容が大きすぎます。" }, { status: 413 });
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "更新内容が大きすぎます。" }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "更新内容の形式が正しくありません。" }, { status: 400 });
    }
    if (!isUserProfile(parsed)) return NextResponse.json({ error: "プロフィールの入力を確認してください。" }, { status: 400 });

    const response = await supabaseRestRequest(
      `user_profiles?on_conflict=user_id&select=${PROFILE_COLUMNS}`,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          user_id: current.user.id,
          age: parsed.age,
          household_type: parsed.householdType,
          children: parsed.children,
          base_currency: parsed.baseCurrency,
          current_city: parsed.currentCity,
          priorities: parsed.priorities,
          updated_at: new Date().toISOString(),
        }),
      },
      current.accessToken,
    );
    if (!response.ok) return NextResponse.json({ error: "プロフィールを保存できませんでした。" }, { status: 502 });
    const rows: unknown = await response.json();
    const profile = profileFromRow(Array.isArray(rows) ? rows[0] : null);
    if (!profile) return NextResponse.json({ error: "保存結果を確認できませんでした。" }, { status: 502 });
    return NextResponse.json({ profile });
  } catch (error) {
    return unavailable(error);
  }
}
