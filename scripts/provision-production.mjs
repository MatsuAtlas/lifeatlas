#!/usr/bin/env node
// LifeAtlas本番（Vercel）の設定を自動で行うスクリプトです。
//   node scripts/provision-production.mjs          … 確認のみ（何も変更しません）
//   node scripts/provision-production.mjs --apply  … 実際に設定します
// 必要な環境変数：VERCEL_TOKEN、SUPABASE_ACCESS_TOKEN、STRIPE_TEST_SECRET_KEY（sk_test_ のみ）
// 任意：VERCEL_TEAM_SLUG（既定 life-atlas1）、VERCEL_PROJECT（既定 lifeatlas）、SUPABASE_PROJECT_REF、AI_GATEWAY_API_KEY
// 秘密値は表示・保存しません。Stripeはテストモード以外を拒否し、live課金や削除は行いません。
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];
export const PLAN_PRICES = [
  { lookupKey: "lifeatlas_pro_monthly", envKey: "STRIPE_PRO_MONTHLY_PRICE_ID", unitAmount: 1_200, interval: "month" },
  { lookupKey: "lifeatlas_pro_annual", envKey: "STRIPE_PRO_ANNUAL_PRICE_ID", unitAmount: 7_900, interval: "year" },
];
// URLだけは表示してよい値です。鍵類はNEXT_PUBLIC_でも表示しません。
const DISPLAYABLE_KEYS = new Set(["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const SECRET_KEYS = new Set(["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "LIFEATLAS_DIAGNOSTICS_TOKEN", "AI_GATEWAY_API_KEY"]);

export function mask(value) {
  if (!value) return "(なし)";
  return `設定済み（${value.length}文字）`;
}

// Supabaseの許可リダイレクトURL（カンマ区切り）に、重複なくURLを追加します。
export function mergeAllowList(current, url) {
  const items = (current ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return items.includes(url) ? { value: items.join(","), changed: false } : { value: [...items, url].join(","), changed: true };
}

export function pickProductionDomain(domains) {
  const candidates = domains.filter((domain) => !domain.redirect && !domain.gitBranch);
  const custom = candidates.find((domain) => !domain.name.endsWith(".vercel.app") && domain.verified !== false);
  return (custom ?? candidates.find((domain) => domain.name.endsWith(".vercel.app")) ?? candidates[0])?.name ?? null;
}

export function vercelEnvType(key) {
  if (SECRET_KEYS.has(key)) return "sensitive";
  return key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
}

export function stripeForm(params, prefix = "") {
  const form = new URLSearchParams();
  const add = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((item, index) => add(`${key}[${index}]`, item));
    else if (typeof value === "object") for (const [child, childValue] of Object.entries(value)) add(`${key}[${child}]`, childValue);
    else form.append(key, String(value));
  };
  for (const [key, value] of Object.entries(params)) add(prefix ? `${prefix}[${key}]` : key, value);
  return form;
}

function log(message) {
  console.log(message);
}

async function request(url, init, label) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!response.ok) {
    // エラー本文に秘密値が含まれる可能性があるため、コードとメッセージの先頭だけを出します。
    const code = body?.error?.code ?? body?.code ?? body?.error?.type ?? "";
    throw new Error(`${label} failed: HTTP ${response.status} ${code}`.trim());
  }
  return body;
}

function clients(env) {
  const vercelToken = env.VERCEL_TOKEN?.trim();
  const supabaseToken = env.SUPABASE_ACCESS_TOKEN?.trim();
  const stripeKey = env.STRIPE_TEST_SECRET_KEY?.trim();
  const missing = [["VERCEL_TOKEN", vercelToken], ["SUPABASE_ACCESS_TOKEN", supabaseToken], ["STRIPE_TEST_SECRET_KEY", stripeKey]].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`環境変数が未設定です：${missing.join(", ")}`);
  if (!/^(sk|rk)_test_/.test(stripeKey)) throw new Error("STRIPE_TEST_SECRET_KEY はテストモードの鍵（sk_test_ / rk_test_）だけを受け付けます。");
  const slug = env.VERCEL_TEAM_SLUG?.trim() || "life-atlas1";
  const vercel = (path, init = {}) => {
    const url = new URL(`https://api.vercel.com${path}`);
    url.searchParams.set("slug", slug);
    return request(url, { ...init, headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json", ...init.headers } }, `Vercel ${path.split("?")[0]}`);
  };
  const supabase = (path, init = {}) => request(`https://api.supabase.com${path}`, { ...init, headers: { Authorization: `Bearer ${supabaseToken}`, "Content-Type": "application/json", ...init.headers } }, `Supabase ${path.split("?")[0]}`);
  const stripe = (path, params, method = params ? "POST" : "GET") => {
    const url = new URL(`https://api.stripe.com${path}`);
    return request(url, { method, headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params ? stripeForm(params) : undefined }, `Stripe ${path}`);
  };
  return { vercel, supabase, stripe, stripeKey };
}

async function main(argv, env) {
  const apply = argv.includes("--apply");
  log(apply ? "== 実行モード：設定を変更します ==" : "== 確認モード：何も変更しません（実行するには --apply）==");
  const { vercel, supabase, stripe, stripeKey } = clients(env);
  const projectName = env.VERCEL_PROJECT?.trim() || "lifeatlas";

  // 1. Vercel：プロジェクトと本番URL
  const project = await vercel(`/v9/projects/${projectName}`);
  const { domains = [] } = await vercel(`/v9/projects/${project.id}/domains`);
  const domain = pickProductionDomain(domains);
  if (!domain) throw new Error("Vercelの本番ドメインが見つかりません。");
  const siteUrl = `https://${domain}`;
  log(`Vercel：プロジェクト ${project.name}、本番URL ${siteUrl}`);

  // 2. Supabase：プロジェクト、APIキー、認証のリダイレクトURL
  const projects = await supabase("/v1/projects");
  const ref = env.SUPABASE_PROJECT_REF?.trim() || (projects.length === 1 ? projects[0].id : null);
  if (!ref) throw new Error(`Supabaseのプロジェクトが${projects.length}件あります。SUPABASE_PROJECT_REF で指定してください（候補：${projects.map((item) => item.name).join(", ")}）。`);
  const keys = await supabase(`/v1/projects/${ref}/api-keys?reveal=true`);
  const anonKey = keys.find((key) => key.name === "anon")?.api_key ?? keys.find((key) => key.type === "publishable")?.api_key;
  const serviceKey = keys.find((key) => key.name === "service_role")?.api_key ?? keys.find((key) => key.type === "secret")?.api_key;
  if (!anonKey || !serviceKey) throw new Error("SupabaseのAPIキーを取得できませんでした。");
  const supabaseUrl = `https://${ref}.supabase.co`;
  log(`Supabase：プロジェクト ${ref}、anon ${mask(anonKey)}、service role ${mask(serviceKey)}`);
  const auth = await supabase(`/v1/projects/${ref}/config/auth`);
  const callback = `${siteUrl}/api/auth/callback`;
  const allowList = mergeAllowList(auth.uri_allow_list, callback);
  log(`Supabase Auth：Google ${auth.external_google_enabled ? "有効" : "無効（Google Cloud側のクライアント設定が必要）"}、リダイレクトURL ${allowList.changed ? "追加が必要" : "登録済み"}`);
  if (apply && allowList.changed) {
    await supabase(`/v1/projects/${ref}/config/auth`, { method: "PATCH", body: JSON.stringify({ uri_allow_list: allowList.value }) });
    log("  → リダイレクトURLを追加しました。");
  }
  const tableCheck = await supabase(`/v1/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query: "select table_name, (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) as rls from information_schema.tables where table_schema = 'public' and table_name in ('comparison_history','user_profiles','ai_recommendations','billing_subscriptions','public_shares','analytics_events') order by 1" }) }).catch((error) => { log(`  テーブル確認をスキップ：${error.message}`); return null; });
  if (tableCheck) {
    log(`Supabase テーブル：${tableCheck.length}/6 件存在、RLS有効 ${tableCheck.filter((row) => row.rls).length} 件`);
    if (tableCheck.length < 6) log("  → supabase/schema.sql の適用が必要です（このスクリプトは自動適用しません）。");
  }

  // 3. Stripe（テストモードのみ）：Price、Webhook、Customer Portal
  const priceIds = {};
  const existingPrices = await stripe(`/v1/prices?active=true&limit=10&${PLAN_PRICES.map((plan) => `lookup_keys[]=${plan.lookupKey}`).join("&")}`);
  let productId = existingPrices.data[0]?.product ?? null;
  for (const plan of PLAN_PRICES) {
    const found = existingPrices.data.find((price) => price.lookup_key === plan.lookupKey);
    if (found) {
      const ok = found.unit_amount === plan.unitAmount && found.currency === "usd" && found.recurring?.interval === plan.interval;
      log(`Stripe Price ${plan.lookupKey}：既存（${ok ? "金額一致" : "金額・間隔が不一致"}）`);
      priceIds[plan.envKey] = found.id;
      continue;
    }
    log(`Stripe Price ${plan.lookupKey}：${apply ? "作成します" : "未作成"}`);
    if (!apply) continue;
    if (!productId) productId = (await stripe("/v1/products", { name: "LifeAtlas Pro", metadata: { app: "lifeatlas" } })).id;
    const created = await stripe("/v1/prices", { product: productId, currency: "usd", unit_amount: plan.unitAmount, recurring: { interval: plan.interval }, lookup_key: plan.lookupKey });
    priceIds[plan.envKey] = created.id;
  }
  const webhookUrl = `${siteUrl}/api/webhooks/stripe`;
  const endpoints = await stripe("/v1/webhook_endpoints?limit=100");
  const current = endpoints.data.find((endpoint) => endpoint.url === webhookUrl && endpoint.status === "enabled");
  let webhookSecret = null;
  const vercelEnvs = (await vercel(`/v10/projects/${project.id}/env`)).envs ?? [];
  const hasEnv = (key) => vercelEnvs.some((item) => item.key === key && item.target?.includes("production"));
  if (current && hasEnv("STRIPE_WEBHOOK_SECRET")) {
    log("Stripe Webhook：登録済み（署名用シークレットもVercelに登録済み）");
  } else {
    log(`Stripe Webhook：${apply ? "新しく作成します" : "作成が必要"}${current ? "（既存の同URLは署名シークレットが取得できないため無効化）" : ""}`);
    if (apply) {
      const created = await stripe("/v1/webhook_endpoints", { url: webhookUrl, enabled_events: REQUIRED_WEBHOOK_EVENTS, description: "LifeAtlas production (Vercel)" });
      webhookSecret = created.secret;
      if (current) await stripe(`/v1/webhook_endpoints/${current.id}`, { disabled: true });
    }
  }
  const portal = await stripe("/v1/billing_portal/configurations?active=true&limit=1");
  if (portal.data.length) log("Stripe Customer Portal：設定済み");
  else {
    log(`Stripe Customer Portal：${apply ? "作成します" : "未設定"}`);
    if (apply) await stripe("/v1/billing_portal/configurations", { features: { customer_update: { enabled: false }, invoice_history: { enabled: true }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: "at_period_end" } }, default_return_url: `${siteUrl}/account` });
  }

  // 4. Vercelの環境変数（Productionのみ）
  const diagnosticsToken = hasEnv("LIFEATLAS_DIAGNOSTICS_TOKEN") ? null : randomBytes(32).toString("hex");
  const desired = {
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    STRIPE_SECRET_KEY: stripeKey,
    ...priceIds,
    ...(webhookSecret ? { STRIPE_WEBHOOK_SECRET: webhookSecret } : {}),
    ...(diagnosticsToken ? { LIFEATLAS_DIAGNOSTICS_TOKEN: diagnosticsToken } : {}),
    ...(env.AI_GATEWAY_API_KEY?.trim() ? { AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY.trim() } : {}),
  };
  for (const [key, value] of Object.entries(desired)) {
    log(`Vercel 環境変数 ${key}：${DISPLAYABLE_KEYS.has(key) ? value : mask(value)}${apply ? " → 登録" : ""}`);
    if (apply) await vercel(`/v10/projects/${project.id}/env?upsert=true`, { method: "POST", body: JSON.stringify({ key, value, type: vercelEnvType(key), target: ["production"] }) });
  }
  if (!hasEnv("AI_GATEWAY_API_KEY") && !desired.AI_GATEWAY_API_KEY) log("AI説明：AI_GATEWAY_API_KEY 未設定（費用が発生し得るため、作成はユーザー判断）。");
  if (!apply) return;

  // 5. 再デプロイと動作確認
  const { deployments = [] } = await vercel(`/v6/deployments?projectId=${project.id}&target=production&limit=1`);
  if (!deployments[0]) throw new Error("本番デプロイが見つかりません。");
  const redeploy = await vercel("/v13/deployments?forceNew=1", { method: "POST", body: JSON.stringify({ name: project.name, deploymentId: deployments[0].uid, target: "production" }) });
  log(`再デプロイを開始しました（${redeploy.id}）。完了を待ちます…`);
  let state = redeploy.readyState;
  for (let attempt = 0; attempt < 60 && !["READY", "ERROR", "CANCELED"].includes(state); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    state = (await vercel(`/v13/deployments/${redeploy.id}`)).readyState;
  }
  log(`再デプロイ：${state}`);
  if (state !== "READY" || !diagnosticsToken) {
    if (!diagnosticsToken) log("診断トークンは以前から登録済みのため、診断APIの呼び出しは省略しました。");
    return;
  }
  const report = await request(`${siteUrl}/api/operations/diagnostics?probe=1`, { headers: { Authorization: `Bearer ${diagnosticsToken}` } }, "diagnostics");
  const flat = [];
  const walk = (value, path) => {
    if (value && typeof value === "object" && "status" in value && typeof value.status === "string") flat.push(`${path}: ${value.status}${value.detail ? ` (${value.detail})` : ""}`);
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
  };
  walk(report.environment, "env");
  walk(report.probes, "probe");
  log("診断結果：");
  for (const line of flat) log(`  ${line}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(`エラー：${error.message}`);
    process.exitCode = 1;
  });
}
