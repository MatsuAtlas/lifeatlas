import { cookies } from "next/headers";

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
};

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

type CookieWriter = {
  set: (name: string, value: string, options: CookieOptions) => unknown;
};

const ACCESS_TOKEN_COOKIE = "life_atlas_access_token";
const REFRESH_TOKEN_COOKIE = "life_atlas_refresh_token";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_NOT_CONFIGURED");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function isSupabaseNotConfiguredError(error: unknown): error is SupabaseNotConfiguredError {
  return error instanceof SupabaseNotConfiguredError
    || (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED");
}

function getConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new SupabaseNotConfiguredError();

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SupabaseNotConfiguredError();
  }
  const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new SupabaseNotConfiguredError();
  }

  return { url: url.toString().replace(/\/$/, ""), key };
}

export async function supabaseAuthRequest(path: string, init: RequestInit = {}) {
  const { url, key } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(new URL(`auth/v1/${path.replace(/^\/+/, "")}`, `${url}/`), {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

export async function supabaseRestRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  const { url, key } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(new URL(`rest/v1/${path.replace(/^\/+/, "")}`, `${url}/`), {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

export async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  getConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const response = await supabaseAuthRequest("user", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.ok) {
      const user = await response.json();
      if (typeof user?.id === "string") return { user, accessToken };
    } else if (response.status !== 401 && response.status !== 403) {
      throw new Error("SUPABASE_AUTH_UNAVAILABLE");
    }
  }

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  const refreshResponse = await supabaseAuthRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!refreshResponse.ok) {
    clearCookies(cookieStore);
    return null;
  }

  const session = await refreshResponse.json() as SupabaseSession;
  if (typeof session.access_token !== "string" || typeof session.user?.id !== "string") {
    clearCookies(cookieStore);
    return null;
  }
  writeSessionCookies(cookieStore, session);
  return { user: session.user, accessToken: session.access_token };
}

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

function writeSessionCookies(target: CookieWriter, session: SupabaseSession) {
  target.set(ACCESS_TOKEN_COOKIE, session.access_token, cookieOptions(Math.max(1, Math.floor(session.expires_in ?? 3600))));
  if (session.refresh_token) target.set(REFRESH_TOKEN_COOKIE, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

function clearCookies(target: CookieWriter) {
  target.set(ACCESS_TOKEN_COOKIE, "", cookieOptions(0));
  target.set(REFRESH_TOKEN_COOKIE, "", cookieOptions(0));
}

export function setSessionCookies(response: Response, session: SupabaseSession) {
  const target = response as Response & { cookies?: CookieWriter };
  if (!target.cookies) return;
  writeSessionCookies(target.cookies, session);
}

export function clearSessionCookies(response: Response) {
  const target = response as Response & { cookies?: CookieWriter };
  if (!target.cookies) return;
  clearCookies(target.cookies);
}
