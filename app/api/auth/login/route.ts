import { NextResponse } from "next/server";
import { setSessionCookies, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });

    const response = await supabaseAuthRequest("token?grant_type=password", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "メールアドレスまたはパスワードを確認してください。" }, { status: 401 });

    const output = NextResponse.json({ user: data.user ? { id: data.user.id, email: data.user.email } : null });
    setSessionCookies(output, data);
    return output;
  } catch (error) {
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") return NextResponse.json({ error: "Supabaseの接続設定がまだありません。" }, { status: 503 });
    return NextResponse.json({ error: "ログイン処理に失敗しました。" }, { status: 500 });
  }
}
