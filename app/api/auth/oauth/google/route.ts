import { NextResponse } from "next/server";

import { authOrigin, createPkcePair, OAUTH_NEXT_COOKIE, OAUTH_VERIFIER_COOKIE, safeAuthNext } from "../../../../../lib/auth/oauth";
import { isSupabaseNotConfiguredError, supabaseAuthUrl } from "../../../../../lib/supabase-server";

const COOKIE_MAX_AGE = 10 * 60;

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = authOrigin(request.url);
    const next = safeAuthNext(requestUrl.searchParams.get("next"));
    const callback = new URL("/api/auth/callback", origin);
    const { verifier, challenge } = createPkcePair();
    const authorize = supabaseAuthUrl("authorize");
    authorize.searchParams.set("provider", "google");
    authorize.searchParams.set("redirect_to", callback.toString());
    authorize.searchParams.set("scopes", "openid email profile");
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "s256");

    const response = NextResponse.redirect(authorize);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth", maxAge: COOKIE_MAX_AGE };
    response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, options);
    response.cookies.set(OAUTH_NEXT_COOKIE, next, options);
    return response;
  } catch (error) {
    const destination = new URL("/account?auth=unavailable", authOrigin(request.url));
    if (!isSupabaseNotConfiguredError(error)) destination.searchParams.set("auth", "error");
    return NextResponse.redirect(destination);
  }
}
