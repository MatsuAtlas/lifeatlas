import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authOrigin, OAUTH_NEXT_COOKIE, OAUTH_VERIFIER_COOKIE, safeAuthNext } from "../../../../lib/auth/oauth";
import { setSessionCookies, supabaseAuthRequest } from "../../../../lib/supabase-server";

function clearOauthCookies(response: NextResponse) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth", maxAge: 0 };
  response.cookies.set(OAUTH_VERIFIER_COOKIE, "", options);
  response.cookies.set(OAUTH_NEXT_COOKIE, "", options);
}

export async function GET(request: Request) {
  const origin = authOrigin(request.url);
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  const next = safeAuthNext(cookieStore.get(OAUTH_NEXT_COOKIE)?.value ?? null);
  const errorRedirect = () => {
    const response = NextResponse.redirect(new URL("/account?auth=error", origin));
    clearOauthCookies(response);
    return response;
  };

  const code = requestUrl.searchParams.get("code");
  if (!code || !verifier || code.length > 2_048 || verifier.length > 256) return errorRedirect();
  try {
    const tokenResponse = await supabaseAuthRequest("token?grant_type=pkce", {
      method: "POST",
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    });
    const session = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || typeof session?.access_token !== "string" || typeof session?.user?.id !== "string") return errorRedirect();
    const response = NextResponse.redirect(new URL(next, origin));
    setSessionCookies(response, session);
    clearOauthCookies(response);
    return response;
  } catch {
    return errorRedirect();
  }
}
