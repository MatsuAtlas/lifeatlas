import { NextResponse } from "next/server";
import { clearSessionCookies, getAccessToken, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST() {
  try {
    const accessToken = await getAccessToken();
    if (accessToken) await supabaseAuthRequest("logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
    const output = NextResponse.json({ ok: true });
    clearSessionCookies(output);
    return output;
  } catch (error) {
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") return NextResponse.json({ error: "Supabaseの接続設定がまだありません。" }, { status: 503 });
    return NextResponse.json({ error: "ログアウト処理に失敗しました。" }, { status: 500 });
  }
}
