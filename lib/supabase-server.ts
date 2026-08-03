import { cookies } from "next/headers";

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseAuthRequest(path: string, init: RequestInit = {}) {
  const { url, key } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  return fetch(`${url}/auth/v1/${path}`, { ...init, headers, cache: "no-store" });
}

export async function supabaseRestRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  const { url, key } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
}

export async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("life_atlas_access_token")?.value ?? null;
}

export async function getCurrentUser() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await supabaseAuthRequest("user", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return { user, accessToken };
}

export function setSessionCookies(response: Response, session: SupabaseSession) {
  const target = response as Response & { cookies?: { set: (name: string, value: string, options: Record<string, unknown>) => void } };
  if (!target.cookies) return;
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.max(300, session.expires_in ?? 3600) };
  target.cookies.set("life_atlas_access_token", session.access_token, options);
  if (session.refresh_token) target.cookies.set("life_atlas_refresh_token", session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
}

export function clearSessionCookies(response: Response) {
  const target = response as Response & { cookies?: { set: (name: string, value: string, options: Record<string, unknown>) => void } };
  if (!target.cookies) return;
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 };
  target.cookies.set("life_atlas_access_token", "", options);
  target.cookies.set("life_atlas_refresh_token", "", options);
}
