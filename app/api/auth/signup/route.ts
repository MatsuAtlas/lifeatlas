import { NextResponse } from "next/server";
import { isSupabaseNotConfiguredError, setSessionCookies, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
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
