import assert from "node:assert/strict";
import test from "node:test";

import { mask, mergeAllowList, pickProductionDomain, stripeForm, vercelEnvType } from "../scripts/provision-production.mjs";

test("provisioning never reveals secret values in its output helpers", () => {
  assert.equal(mask("sk_test_abcdef"), "設定済み（14文字）");
  assert.equal(mask(""), "(なし)");
  assert.equal(vercelEnvType("SUPABASE_SERVICE_ROLE_KEY"), "sensitive");
  assert.equal(vercelEnvType("STRIPE_WEBHOOK_SECRET"), "sensitive");
  assert.equal(vercelEnvType("NEXT_PUBLIC_SUPABASE_URL"), "plain");
  assert.equal(vercelEnvType("STRIPE_PRO_MONTHLY_PRICE_ID"), "encrypted");
});

test("adds the auth callback to Supabase redirect URLs without duplicates", () => {
  assert.deepEqual(mergeAllowList("https://a.example/cb, https://b.example/cb", "https://c.example/cb"), { value: "https://a.example/cb,https://b.example/cb,https://c.example/cb", changed: true });
  assert.deepEqual(mergeAllowList("https://c.example/cb", "https://c.example/cb"), { value: "https://c.example/cb", changed: false });
  assert.deepEqual(mergeAllowList(null, "https://c.example/cb"), { value: "https://c.example/cb", changed: true });
});

test("chooses the production domain and encodes Stripe form parameters", () => {
  assert.equal(pickProductionDomain([{ name: "lifeatlas-git-x.vercel.app", gitBranch: "x" }, { name: "lifeatlas-a.vercel.app" }]), "lifeatlas-a.vercel.app");
  assert.equal(pickProductionDomain([{ name: "lifeatlas-a.vercel.app" }, { name: "lifeatlas.example", verified: true }]), "lifeatlas.example");
  assert.equal(pickProductionDomain([{ name: "old.vercel.app", redirect: "lifeatlas-a.vercel.app" }]), null);
  const form = stripeForm({ url: "https://x/api", enabled_events: ["a", "b"], recurring: { interval: "month" } });
  assert.equal(form.toString(), "url=https%3A%2F%2Fx%2Fapi&enabled_events%5B0%5D=a&enabled_events%5B1%5D=b&recurring%5Binterval%5D=month");
});
