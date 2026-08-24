import { NextResponse } from "next/server";
import { clearSessionCookies, getAccessToken, isSupabaseConfigured, isSupabaseNotConfiguredError, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
  let configured = isSupabaseConfigured();
  try {
    if (configured) {
      const accessToken = await getAccessToken();
      if (accessToken) await supabaseAuthRequest("logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
    }
  } catch (error) {
    configured = !isSupabaseNotConfiguredError(error);
  }
  const output = NextResponse.json({ ok: true, configured });
  clearSessionCookies(output);
  return output;
}
