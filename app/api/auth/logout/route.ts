import { NextResponse } from "next/server";
import { clearSessionCookies, getAccessToken, isSupabaseConfigured, isSupabaseNotConfiguredError, supabaseAuthRequest } from "../../../../lib/supabase-server";

export async function POST() {
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
