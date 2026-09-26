import { createHash, timingSafeEqual } from "node:crypto";

import { PUBLIC_BILLING_PLANS } from "../billing/plans.ts";
import type { BillingInterval } from "../../types/billing";

// 本番設定の有無・形式だけを返す診断です。秘密値そのものは絶対に返しません。

type Env = Record<string, string | undefined>;

export type CheckStatus = "ok" | "missing" | "invalid" | "warning" | "unverified";
export type DiagnosticCheck = { status: CheckStatus; detail?: string };
export type StripeKeyMode = "test" | "live" | "unknown" | null;

export const SUPABASE_TABLES = [
  "comparison_history",
  "user_profiles",
  "ai_recommendations",
  "billing_subscriptions",
  "public_shares",
  "analytics_events",
] as const;

export const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

const SECRET_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "AI_GATEWAY_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "LIFEATLAS_DIAGNOSTICS_TOKEN"];

const value = (env: Env, name: string) => env[name]?.trim() || "";
const present = (env: Env, name: string): DiagnosticCheck => (value(env, name) ? { status: "ok" } : { status: "missing" });
const prefixed = (env: Env, name: string, prefixes: string[]): DiagnosticCheck => {
  const current = value(env, name);
  if (!current) return { status: "missing" };
  return prefixes.some((prefix) => current.startsWith(prefix)) ? { status: "ok" } : { status: "invalid", detail: `expected prefix ${prefixes.join(" or ")}` };
};

export function stripeKeyMode(key: string | undefined): StripeKeyMode {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (/^(sk|rk)_test_/.test(trimmed)) return "test";
  if (/^(sk|rk)_live_/.test(trimmed)) return "live";
  return "unknown";
}

function positiveInteger(env: Env, name: string): DiagnosticCheck {
  const current = value(env, name);
  if (!current) return { status: "warning", detail: "unset; code default is used" };
  return /^\d+$/.test(current) && Number(current) > 0 ? { status: "ok", detail: current } : { status: "invalid", detail: "must be a positive integer" };
}

function siteUrlCheck(env: Env): DiagnosticCheck {
  const current = value(env, "NEXT_PUBLIC_SITE_URL");
  if (!current) return { status: "warning", detail: "unset; built-in production URL is used" };
  try {
    const url = new URL(current);
    return url.protocol === "https:" ? { status: "ok", detail: url.origin } : { status: "invalid", detail: "must be https" };
  } catch {
    return { status: "invalid", detail: "not a URL" };
  }
}

// NEXT_PUBLIC_で始まる変数はブラウザへ埋め込まれるため、秘密値らしい名前や値が混入していないかを確認します。
export function findExposedSecrets(env: Env) {
  const secretValues = SECRET_NAMES.map((name) => value(env, name)).filter(Boolean);
  return Object.entries(env)
    .filter(([name, current]) => name.startsWith("NEXT_PUBLIC_") && current?.trim())
    .filter(([name, current]) => /SERVICE_ROLE|SECRET|STRIPE_SECRET|GATEWAY_API_KEY/.test(name)
      || /^(sk|rk)_(test|live)_|^whsec_|^sb_secret_/.test(current!.trim())
      || secretValues.includes(current!.trim()))
    .map(([name]) => name);
}

export function evaluateEnvironment(env: Env) {
  const exposed = findExposedSecrets(env);
  const monthlyPrice = prefixed(env, "STRIPE_PRO_MONTHLY_PRICE_ID", ["price_"]);
  const annualPrice = prefixed(env, "STRIPE_PRO_ANNUAL_PRICE_ID", ["price_"]);
  return {
    supabase: {
      url: prefixed(env, "NEXT_PUBLIC_SUPABASE_URL", ["https://"]),
      anonKey: present(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      serviceRoleKey: present(env, "SUPABASE_SERVICE_ROLE_KEY"),
    },
    site: { url: siteUrlCheck(env) },
    ai: {
      credential: value(env, "AI_GATEWAY_API_KEY")
        ? { status: "ok" as const }
        : value(env, "VERCEL_OIDC_TOKEN")
          ? { status: "warning" as const, detail: "only a short-lived OIDC token is set; use AI_GATEWAY_API_KEY on Sites" }
          : { status: "missing" as const },
      model: value(env, "LIFEATLAS_AI_MODEL") || null,
      freeDailyLimit: positiveInteger(env, "LIFEATLAS_FREE_AI_DAILY_LIMIT"),
      proDailyLimit: positiveInteger(env, "LIFEATLAS_PRO_AI_DAILY_LIMIT"),
    },
    stripe: {
      secretKey: prefixed(env, "STRIPE_SECRET_KEY", ["sk_", "rk_"]),
      keyMode: stripeKeyMode(env.STRIPE_SECRET_KEY),
      webhookSecret: prefixed(env, "STRIPE_WEBHOOK_SECRET", ["whsec_"]),
      monthlyPriceId: monthlyPrice,
      annualPriceId: annualPrice,
      distinctPriceIds: monthlyPrice.status === "ok" && annualPrice.status === "ok"
        ? (value(env, "STRIPE_PRO_MONTHLY_PRICE_ID") !== value(env, "STRIPE_PRO_ANNUAL_PRICE_ID") ? { status: "ok" as const } : { status: "invalid" as const, detail: "monthly and annual price IDs are identical" })
        : { status: "unverified" as const },
    },
    clientExposure: exposed.length === 0 ? { status: "ok" as const } : { status: "invalid" as const, detail: `secret-like NEXT_PUBLIC_ variables: ${exposed.join(", ")}` },
  };
}

export type StripePriceSnapshot = {
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string } | null;
};

// UI表示価格（PUBLIC_BILLING_PLANS）とStripe側Priceの一致を確認します。
export function evaluateStripePrice(price: StripePriceSnapshot, interval: BillingInterval, keyMode: StripeKeyMode): DiagnosticCheck {
  const expected = PUBLIC_BILLING_PLANS[interval];
  const problems: string[] = [];
  if (!price.active) problems.push("price is inactive");
  if (price.currency.toLowerCase() !== "usd") problems.push(`currency ${price.currency} != usd`);
  if (price.unit_amount !== expected.amountUsd * 100) problems.push(`amount ${price.unit_amount} != ${expected.amountUsd * 100}`);
  if (price.recurring?.interval !== interval) problems.push(`interval ${price.recurring?.interval ?? "one-time"} != ${interval}`);
  if (keyMode === "test" && price.livemode) problems.push("live price with test key");
  if (keyMode === "live" && !price.livemode) problems.push("test price with live key");
  return problems.length === 0 ? { status: "ok", detail: `${expected.label} (${price.livemode ? "live" : "test"})` } : { status: "invalid", detail: problems.join("; ") };
}

export type StripeWebhookEndpointSnapshot = { url: string; status: string; enabled_events: string[]; livemode: boolean };

export function evaluateStripeWebhookEndpoints(endpoints: StripeWebhookEndpointSnapshot[], expectedUrl: string): DiagnosticCheck {
  const matches = endpoints.filter((endpoint) => endpoint.url.replace(/\/$/, "") === expectedUrl);
  if (matches.length === 0) return { status: "missing", detail: `no endpoint for ${expectedUrl}` };
  const enabled = matches.filter((endpoint) => endpoint.status === "enabled");
  if (enabled.length === 0) return { status: "invalid", detail: "endpoint exists but is disabled" };
  const covered = enabled.find((endpoint) => endpoint.enabled_events.includes("*") || REQUIRED_STRIPE_WEBHOOK_EVENTS.every((event) => endpoint.enabled_events.includes(event)));
  if (!covered) {
    const missing = REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((event) => !enabled.some((endpoint) => endpoint.enabled_events.includes(event)));
    return { status: "invalid", detail: `missing events: ${missing.join(", ")}` };
  }
  return { status: "ok", detail: `${enabled.length} enabled endpoint(s)` };
}

export function isAuthorizedDiagnosticsRequest(authorization: string | null, token: string | undefined) {
  const expected = token?.trim();
  if (!expected || expected.length < 24 || !authorization?.startsWith("Bearer ")) return false;
  const digest = (input: string) => createHash("sha256").update(input).digest();
  return timingSafeEqual(digest(authorization.slice("Bearer ".length).trim()), digest(expected));
}
