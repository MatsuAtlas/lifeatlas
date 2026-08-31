import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let app;
let baseUrl;
let serverOutput = "";

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitUntilReady(child) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Next.js did not start in time.\n${serverOutput}`)), 15_000);
    const onData = (chunk) => {
      serverOutput += chunk.toString();
      if (serverOutput.includes("Ready in")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Next.js exited with code ${code}.\n${serverOutput}`));
    });
  });
}

test.before(async () => {
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" };
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitUntilReady(app);
});

test.after(async () => {
  if (!app || app.exitCode !== null) return;
  app.kill("SIGTERM");
  await Promise.race([once(app, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
});

test("renders the account and comparison history interface", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Life Atlas/);
  assert.match(html, /登録と比較履歴/);
  assert.match(html, /登録後はSupabase（オンライン保存サービス）に保存されます/);
  assert.doesNotMatch(html, /Supabase未設定時の確認用として、この端末にのみ保存します/);
  assert.match(html, /現在のデータ範囲/);
  assert.match(html, /都市人口の基準値/);
  assert.match(html, /目的地での働き方・給与条件/);
  assert.match(html, /現地就職：公式給与ベンチマーク/);
  assert.match(html, /リモート勤務：日本の収入を維持/);
  assert.match(html, /実際のオファー年収を入力/);
  assert.match(html, /給与または税制度を公式資料で確認できない都市は手取り・残額を表示しません/);
  assert.match(html, /Life Atlasの50都市すべてを対象/);
  assert.match(html, /50都市すべてを候補にします/);
  assert.match(html, />50<\/strong>対象都市/);
  assert.match(html, />10<\/strong>ビジネス詳細あり/);
  assert.match(html, />40<\/strong>ビジネス参考値/);
  assert.match(html, /詳細未整備・参考スコアを50%補正|ビジネス詳細データあり/);
  assert.match(html, /この都市を詳しく比較する/);
  assert.match(html, /Inland Revenue Authority of Singapore/);
  assert.doesNotMatch(html, /8\.5百万円/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
});

test("renders the Offer Analyzer as a separate deterministic decision flow", async () => {
  const response = await fetch(`${baseUrl}/analyze`);
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /LifeAtlas Offer Analyzer/);
  assert.match(html, /2〜5件の仕事・移住案/);
  assert.match(html, /AIに数字を作らせず/);
  assert.match(html, /What-If シミュレーター/);
  assert.match(html, /逆転に必要な給与/);
  assert.match(html, /分析を保存する/);
  assert.match(html, /Freeは1件、Proは無制限にアカウント保存できます/);
  assert.match(html, /href="\/#account"/);
  assert.match(html, /AIに結果を説明してもらう/);
  assert.match(html, /計算は固定、説明だけAI/);
  assert.match(html, /氏名やメールアドレスは送りません/);
  assert.match(html, /税務・金融・移住助言ではありません/);
  assert.match(html, /Freeは2件、Proは最大5件/);
  assert.match(html, /href="\/pricing"/);
});

test("renders configurable Free and Pro pricing plus a private account page", async () => {
  const pricing = await fetch(`${baseUrl}/pricing`);
  assert.equal(pricing.status, 200);
  const pricingHtml = await pricing.text();
  assert.match(pricingHtml, /大きな意思決定を、数字で確かめる/);
  assert.match(pricingHtml, /\$12 \/ month/);
  assert.match(pricingHtml, /\$79 \/ year/);
  assert.match(pricingHtml, /Stripeの安全な購入画面/);
  assert.doesNotMatch(pricingHtml, /sk_(test|live)_/);

  const account = await fetch(`${baseUrl}/account`);
  assert.equal(account.status, 200);
  assert.match(await account.text(), /アカウントと契約/);
});

test("reports transparent official-data coverage for all comparison cities", async () => {
  const response = await fetch(`${baseUrl}/api/data-refresh`);
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.coverage.cityCount, 50);
  assert.equal(payload.coverage.currencyCount, 23);
  assert.equal(Object.keys(payload.exchangeRates).length, 23);
  assert.equal(Object.keys(payload.populations).length, payload.coverage.countryCount);
  assert.ok(["live", "partial", "fallback"].includes(payload.sourceStatus));
  assert.match(payload.sources[0].scope, /都市人口ではありません/);
  assert.match(payload.sources[1].name, /European Central Bank/);
});

test("reports an unconfigured Supabase server consistently", async () => {
  for (const pathname of ["/api/auth/me", "/api/history"]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).configured, false);
  }

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "valid-password" }),
  });
  assert.equal(login.status, 503);
  assert.equal((await login.json()).configured, false);
});

test("keeps AI optional when its authenticated persistence is unconfigured", async () => {
  const response = await fetch(`${baseUrl}/api/ai/recommendation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).configured, false);
});

test("keeps billing safe when Stripe and Supabase are unconfigured", async () => {
  const status = await fetch(`${baseUrl}/api/billing/status`);
  assert.equal(status.status, 503);
  assert.equal((await status.json()).configured, false);

  const invalidCheckout = await fetch(`${baseUrl}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval: "lifetime" }),
  });
  assert.equal(invalidCheckout.status, 400);

  const crossOrigin = await fetch(`${baseUrl}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" },
    body: JSON.stringify({ interval: "month" }),
  });
  assert.equal(crossOrigin.status, 403);

  const webhook = await fetch(`${baseUrl}/api/webhooks/stripe`, { method: "POST", body: "{}" });
  assert.equal(webhook.status, 503);
});

test("clears the local session even when Supabase is unconfigured", async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, configured: false });
  assert.match(response.headers.get("set-cookie") ?? "", /life_atlas_access_token=/);
});

test("rejects oversized and cross-origin authentication requests", async () => {
  const oversized = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "x".repeat(5_000) }),
  });
  assert.equal(oversized.status, 413);

  const crossOrigin = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" },
    body: JSON.stringify({ email: "test@example.com", password: "valid-password" }),
  });
  assert.equal(crossOrigin.status, 403);
});
