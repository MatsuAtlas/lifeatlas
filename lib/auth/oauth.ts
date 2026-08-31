import { createHash, randomBytes } from "node:crypto";

import { siteUrl } from "../site-url.ts";

export const OAUTH_VERIFIER_COOKIE = "life_atlas_oauth_verifier";
export const OAUTH_NEXT_COOKIE = "life_atlas_oauth_next";

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function safeAuthNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://lifeatlas.invalid");
    if (url.origin !== "https://lifeatlas.invalid") return "/dashboard";
    return `${url.pathname}${url.search}`.slice(0, 300);
  } catch {
    return "/dashboard";
  }
}

export function authOrigin(requestUrl: string) {
  const request = new URL(requestUrl);
  if ((request.hostname === "127.0.0.1" || request.hostname === "localhost") && request.protocol === "http:") return request.origin;
  return siteUrl();
}
