import { NextResponse } from "next/server";
import { isSupabaseNotConfiguredError, setSessionCookies, supabaseAuthRequest } from "../../../../lib/supabase-server";

const MAX_BODY_LENGTH = 4_096;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 415 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) return NextResponse.json({ error: "送信内容が大きすぎます。" }, { status: 413 });
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "送信内容が大きすぎます。" }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 400 });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 400 });
    const credentials = parsed as Record<string, unknown>;
    const { email, password } = credentials;
    if (typeof email !== "string" || email.trim().length === 0 || email.length > 320 || typeof password !== "string" || password.length < 8 || password.length > 1024) {
      return NextResponse.json({ error: "メールアドレスと8文字以上のパスワードを入力してください。" }, { status: 400 });
    }

    const response = await supabaseAuthRequest("signup", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: data?.msg ?? data?.message ?? "登録できませんでした。" }, { status: 400 });

    const output = NextResponse.json({ user: data.user ? { id: data.user.id, email: data.user.email } : null, needsEmailConfirmation: !data.access_token });
    if (data.access_token) setSessionCookies(output, data);
    return output;
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "Supabaseの接続設定がまだありません。", configured: false }, { status: 503 });
    return NextResponse.json({ error: "登録処理に失敗しました。" }, { status: 500 });
  }
}
