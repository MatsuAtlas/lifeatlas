import { gateway } from "ai";
import { NextResponse } from "next/server";

import { getAIModelId } from "../../../../lib/ai/provider";
import { getStripeClient } from "../../../../lib/billing/stripe-server";
import {
  evaluateEnvironment,
  evaluateStripePrice,
  evaluateStripeWebhookEndpoints,
  isAuthorizedDiagnosticsRequest,
  stripeKeyMode,
  SUPABASE_TABLES,
  type DiagnosticCheck,
} from "../../../../lib/operations/config-diagnostics";
import { siteUrl } from "../../../../lib/site-url";
import { supabaseAdminRestRequest, supabaseAuthRequest, supabaseRestRequest } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

// 外部サービスのエラー本文には識別子が含まれ得るため、コード名だけを返します。
const errorCode = (error: unknown) => (error instanceof Error ? error.name === "Error" ? error.message.slice(0, 60) : error.name : "UnknownError");

async function supabaseErrorCode(response: Response) {
  try {
    const body = await response.json() as { code?: unknown };
    return typeof body.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}

async function probeTable(table: string) {
  const path = `${table}?select=*&limit=0`;
  const admin = await supabaseAdminRestRequest(path, { method: "GET" });
  const adminCode = admin.ok ? null : await supabaseErrorCode(admin);
  const exists: DiagnosticCheck = admin.ok || adminCode === "42501"
    ? { status: "ok" }
    : adminCode === "PGRST205" || adminCode === "42P01" || admin.status === 404
      ? { status: "missing", detail: "table not found; apply supabase/schema.sql" }
      : { status: "unverified", detail: `HTTP ${admin.status}${adminCode ? ` ${adminCode}` : ""}` };
  // anonキーだけで行が見えれば、RLSまたは権限設定が緩んでいます。
  const anon = await supabaseRestRequest(path, { method: "GET", headers: { Prefer: "count=exact" } });
  const range = anon.headers.get("content-range");
  const visibleRows = range ? Number(range.split("/")[1]) : NaN;
  const anonymousAccess: DiagnosticCheck = !anon.ok
    ? { status: "ok", detail: `denied (HTTP ${anon.status})` }
    : visibleRows === 0
      ? { status: "ok", detail: "0 rows visible" }
      : { status: "invalid", detail: `${Number.isFinite(visibleRows) ? visibleRows : "unknown"} rows visible to anon` };
  return { exists, anonymousAccess };
}

async function probeSupabase() {
  const tables: Record<string, Awaited<ReturnType<typeof probeTable>>> = {};
  for (const table of SUPABASE_TABLES) tables[table] = await probeTable(table);
  let googleProvider: DiagnosticCheck;
  try {
    const response = await supabaseAuthRequest("settings", { method: "GET" });
    const settings = response.ok ? await response.json() as { external?: Record<string, unknown> } : null;
    googleProvider = !settings ? { status: "unverified", detail: `HTTP ${response.status}` } : settings.external?.google === true ? { status: "ok" } : { status: "missing", detail: "Google provider disabled" };
  } catch (error) {
    googleProvider = { status: "unverified", detail: errorCode(error) };
  }
  return { tables, googleProvider, redirectAllowList: { status: "unverified", detail: `confirm ${siteUrl()}/api/auth/callback in Supabase Auth URL settings` } satisfies DiagnosticCheck };
}

async function probeStripe() {
  const stripe = getStripeClient();
  const keyMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);
  const prices: Record<string, DiagnosticCheck> = {};
  for (const [interval, name] of [["month", "STRIPE_PRO_MONTHLY_PRICE_ID"], ["year", "STRIPE_PRO_ANNUAL_PRICE_ID"]] as const) {
    const priceId = process.env[name]?.trim();
    if (!priceId) {
      prices[interval] = { status: "missing" };
      continue;
    }
    try {
      prices[interval] = evaluateStripePrice(await stripe.prices.retrieve(priceId), interval, keyMode);
    } catch (error) {
      prices[interval] = { status: "invalid", detail: errorCode(error) };
    }
  }
  let webhookEndpoint: DiagnosticCheck;
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    webhookEndpoint = evaluateStripeWebhookEndpoints(endpoints.data, `${siteUrl()}/api/webhooks/stripe`);
  } catch (error) {
    webhookEndpoint = { status: "unverified", detail: errorCode(error) };
  }
  let customerPortal: DiagnosticCheck;
  try {
    const configurations = await stripe.billingPortal.configurations.list({ limit: 10, active: true });
    customerPortal = configurations.data.length > 0 ? { status: "ok" } : { status: "missing", detail: "no active Customer Portal configuration" };
  } catch (error) {
    customerPortal = { status: "unverified", detail: errorCode(error) };
  }
  return { keyMode, prices, webhookEndpoint, customerPortal };
}

async function probeAI() {
  const model = getAIModelId();
  try {
    const available = await gateway.getAvailableModels();
    return { model, modelAvailable: available.models.some((entry) => entry.id === model) ? { status: "ok" } : { status: "invalid", detail: "model not listed by AI Gateway" } } as const;
  } catch (error) {
    return { model, modelAvailable: { status: "unverified", detail: errorCode(error) } } as const;
  }
}

async function settle<T>(enabled: boolean, probe: () => Promise<T>) {
  if (!enabled) return { status: "skipped" as const };
  try {
    return await probe();
  } catch (error) {
    return { status: "unverified" as const, detail: errorCode(error) };
  }
}

export async function GET(request: Request) {
  // トークン未設定の環境では、このルートの存在自体を見せません。
  if (!isAuthorizedDiagnosticsRequest(request.headers.get("authorization"), process.env.LIFEATLAS_DIAGNOSTICS_TOKEN)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  }
  const environment = evaluateEnvironment(process.env);
  const body: Record<string, unknown> = { checkedAt: new Date().toISOString(), siteUrl: siteUrl(), environment };
  if (new URL(request.url).searchParams.get("probe") === "1") {
    const hasSupabase = environment.supabase.url.status === "ok" && environment.supabase.anonKey.status === "ok" && environment.supabase.serviceRoleKey.status === "ok";
    const [supabase, stripe, ai] = await Promise.all([
      settle(hasSupabase, probeSupabase),
      settle(environment.stripe.secretKey.status === "ok", probeStripe),
      settle(environment.ai.credential.status !== "missing", probeAI),
    ]);
    body.probes = { supabase, stripe, ai };
  }
  return NextResponse.json(body, { headers: noStore });
}
