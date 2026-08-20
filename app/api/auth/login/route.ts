import { NextResponse } from "next/server";
import { isSupabaseNotConfiguredError, setSessionCookies, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || email.trim().length === 0 || email.length > 320 || typeof password !== "string" || password.length === 0 || password.length > 1024) {
      return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
    }

    const response = await supabaseAuthRequest("token?grant_type=password", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: "メールアドレスまたはパスワードを確認してください。" }, { status: 401 });
    if (!data?.access_token) return NextResponse.json({ error: "ログイン処理に失敗しました。" }, { status: 502 });

    const output = NextResponse.json({ user: data.user ? { id: data.user.id, email: data.user.email } : null });
    setSessionCookies(output, data);
    return output;
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "Supabaseの接続設定がまだありません。", configured: false }, { status: 503 });
    return NextResponse.json({ error: "ログイン処理に失敗しました。" }, { status: 500 });
  }
}
