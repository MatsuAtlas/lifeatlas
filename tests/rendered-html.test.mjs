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
  assert.match(html, /href="\/api\/auth\/oauth\/google\?next=\/dashboard"/);
  assert.match(html, /Googleで続ける/);
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

test("renders configurable pricing plus private account and dashboard pages", async () => {
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
  const accountHtml = await account.text();
  assert.match(accountHtml, /アカウントと契約/);

  const failedOauth = await fetch(`${baseUrl}/account?auth=error`);
  assert.equal(failedOauth.status, 200);
  assert.match(await failedOauth.text(), /Googleログインを完了できませんでした/);

  const dashboard = await fetch(`${baseUrl}/dashboard`);
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /保存した意思決定/);
  assert.match(dashboardHtml, /name="robots" content="noindex, nofollow"/);

  const savedAnalysis = await fetch(`${baseUrl}/analyze/62af15f9-5704-4aad-ae7c-b0861bf28334`);
  assert.equal(savedAnalysis.status, 200);
  assert.match(await savedAnalysis.text(), /name="robots" content="noindex, nofollow"/);
});

test("renders high-quality city and curated comparison SEO pages", async () => {
  const city = await fetch(`${baseUrl}/cities/tokyo`);
  assert.equal(city.status, 200);
  const cityHtml = await city.text();
  assert.match(cityHtml, /東京で暮らす数字を、先に見る/);
  assert.match(cityHtml, /給与と生活費の基準シナリオ/);
  assert.match(cityHtml, /データ信頼度/);
  assert.match(cityHtml, /出典と更新範囲/);

  const englishCity = await fetch(`${baseUrl}/cities/tokyo?lang=en`);
  assert.equal(englishCity.status, 200);
  assert.match(await englishCity.text(), /See the numbers behind living in Tokyo/);

  const comparison = await fetch(`${baseUrl}/compare/tokyo-vs-vancouver`);
  assert.equal(comparison.status, 200);
  const comparisonHtml = await comparison.text();
  assert.match(comparisonHtml, /東京/);
  assert.match(comparisonHtml, /バンクーバー/);
  assert.match(comparisonHtml, /LifeAtlas Scoreは財務45%/);

  const thinPage = await fetch(`${baseUrl}/compare/tokyo-vs-paris`);
  assert.equal(thinPage.status, 404);
});

test("publishes sitemap coverage without indexing account or API routes", async () => {
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  const sitemapXml = await sitemap.text();
  assert.match(sitemapXml, /\/cities\/tokyo/);
  assert.match(sitemapXml, /\/cities\/bogota/);
  assert.match(sitemapXml, /\/compare\/tokyo-vs-vancouver/);
  assert.match(sitemapXml, /\/methodology/);
  assert.match(sitemapXml, /\/data/);
  assert.doesNotMatch(sitemapXml, /\/account/);

  const robots = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robots.status, 200);
  const robotsText = await robots.text();
  assert.match(robotsText, /Disallow: \/account/);
  assert.match(robotsText, /Disallow: \/api\//);
});

test("renders bilingual methodology and transparent 50-city data pages", async () => {
  const methodology = await fetch(`${baseUrl}/methodology`);
  assert.equal(methodology.status, 200);
  const methodologyHtml = await methodology.text();
  assert.match(methodologyHtml, /数字が先に決め、AIは後から説明します/);
  assert.match(methodologyHtml, /財務/);
  assert.match(methodologyHtml, />45(?:<!-- -->)?%/);
  assert.match(methodologyHtml, /税モデル45%/);

  const englishMethodology = await fetch(`${baseUrl}/methodology?lang=en`);
  assert.equal(englishMethodology.status, 200);
  assert.match(await englishMethodology.text(), /The numbers decide first/);

  const data = await fetch(`${baseUrl}/data`);
  assert.equal(data.status, 200);
  const dataHtml = await data.text();
  assert.match(dataHtml, /その数字が、どこまで言えるか/);
  assert.match(dataHtml, />50<\/strong>/);
  assert.match(dataHtml, />25<\/strong>/);
  assert.match(dataHtml, /保存推定値を含む/);
  assert.match(dataHtml, /金額計算は未対応/);

  const compare = await fetch(`${baseUrl}/compare`, { redirect: "manual" });
  assert.equal(compare.status, 307);
  assert.match(compare.headers.get("location") ?? "", /\/#compare$/);
});

test("keeps analytics and public sharing safe when services are unconfigured", async () => {
  const analytics = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "analyzer_started", anonymousId: "d65df160-2af9-47ce-9508-f81399bc01c0", pathname: "/analyze", properties: {} }),
  });
  assert.equal(analytics.status, 202);
  assert.deepEqual(await analytics.json(), { accepted: false, configured: false });

  const invalidShare = await fetch(`${baseUrl}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" },
    body: "{}",
  });
  assert.equal(invalidShare.status, 403);

  const invalidRename = await fetch(`${baseUrl}/api/history?id=62af15f9-5704-4aad-ae7c-b0861bf28334`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" },
    body: JSON.stringify({ title: "Changed" }),
  });
  assert.equal(invalidRename.status, 403);

  const invalidProfile = await fetch(`${baseUrl}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" },
    body: JSON.stringify({}),
  });
  assert.equal(invalidProfile.status, 403);

  const missingShare = await fetch(`${baseUrl}/share/1234567890abcdef`);
  assert.equal(missingShare.status, 404);
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

test("exposes validated deterministic decision APIs without duplicating the calculation engine", async () => {
  const tokyo = { id: "api-tokyo", cityId: "tokyo", annualSalary: 7_000_000, salaryCurrency: "JPY", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" };
  const vancouver = { id: "api-vancouver", cityId: "vancouver", annualSalary: 90_000, salaryCurrency: "CAD", age: 29, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" };
  const priorities = { savings: 3, purchasingPower: 3, qualityOfLife: 3, entrepreneurship: 0, fire: 2, family: 0, safety: 3, climate: 0, career: 2, remoteWork: 0 };

  const calculation = await fetch(`${baseUrl}/api/calculate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: tokyo }) });
  assert.equal(calculation.status, 200);
  const calculationPayload = await calculation.json();
  assert.equal(calculationPayload.result.scenarioId, "api-tokyo");
  assert.equal(calculationPayload.result.assumptions.calculationVersion, "2026.08-v2.1");

  const comparison = await fetch(`${baseUrl}/api/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarios: [tokyo, vancouver], priorities }) });
  assert.equal(comparison.status, 200);
  const comparisonPayload = await comparison.json();
  assert.equal(comparisonPayload.results.length, 2);
  assert.deepEqual(comparisonPayload.scores.map((score) => score.rank), [1, 2]);

  const breakEven = await fetch(`${baseUrl}/api/break-even`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: tokyo, candidate: vancouver, metric: "disposableIncome", priorities }) });
  assert.equal(breakEven.status, 200);
  const breakEvenPayload = await breakEven.json();
  assert.equal(breakEvenPayload.result.status, "matched");
  assert.equal(breakEvenPayload.result.candidateScenarioId, "api-vancouver");

  const crossOrigin = await fetch(`${baseUrl}/api/calculate`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid" }, body: JSON.stringify({ scenario: tokyo }) });
  assert.equal(crossOrigin.status, 403);
});

test("publishes typed city catalog APIs with coverage and source metadata", async () => {
  const catalog = await fetch(`${baseUrl}/api/cities`);
  assert.equal(catalog.status, 200);
  const catalogPayload = await catalog.json();
  assert.equal(catalogPayload.coverage.cityCount, 50);
  assert.equal(catalogPayload.cities.length, 50);
  assert.equal(catalogPayload.cities.filter((city) => city.calculationStatus === "unavailable").length, 25);

  const city = await fetch(`${baseUrl}/api/cities/los-angeles`);
  assert.equal(city.status, 200);
  const cityPayload = await city.json();
  assert.equal(cityPayload.city.names.en, "Los Angeles");
  assert.ok(Array.isArray(cityPayload.city.sources));
  assert.ok(cityPayload.city.sources.length > 0);

  const missing = await fetch(`${baseUrl}/api/cities/not-a-city`);
  assert.equal(missing.status, 404);
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

  const oauth = await fetch(`${baseUrl}/api/auth/oauth/google?next=/account`, { redirect: "manual" });
  assert.equal(oauth.status, 307);
  const oauthLocation = new URL(oauth.headers.get("location"));
  assert.equal(oauthLocation.pathname, "/account");
  assert.equal(oauthLocation.search, "?auth=unavailable");
  assert.ok(["localhost", "127.0.0.1"].includes(oauthLocation.hostname));

  const callback = await fetch(`${baseUrl}/api/auth/callback`, { redirect: "manual" });
  assert.equal(callback.status, 307);
  const callbackLocation = new URL(callback.headers.get("location"));
  assert.equal(callbackLocation.pathname, "/account");
  assert.equal(callbackLocation.search, "?auth=error");
  assert.match(callback.headers.get("set-cookie") ?? "", /life_atlas_oauth_verifier=/);
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
