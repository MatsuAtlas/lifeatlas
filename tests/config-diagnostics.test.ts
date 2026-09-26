import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateEnvironment,
  evaluateStripePrice,
  evaluateStripeWebhookEndpoints,
  findExposedSecrets,
  isAuthorizedDiagnosticsRequest,
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
  stripeKeyMode,
} from "../lib/operations/config-diagnostics.ts";

const token = "diagnostics-token-with-enough-length";

test("diagnostics route stays hidden without a configured token", () => {
  assert.equal(isAuthorizedDiagnosticsRequest(`Bearer ${token}`, undefined), false);
  assert.equal(isAuthorizedDiagnosticsRequest("Bearer short", "short"), false);
  assert.equal(isAuthorizedDiagnosticsRequest(null, token), false);
  assert.equal(isAuthorizedDiagnosticsRequest(`Bearer ${token}x`, token), false);
  assert.equal(isAuthorizedDiagnosticsRequest(`Bearer ${token}`, token), true);
});

test("environment summary reports presence and format without returning secret values", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-value",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    STRIPE_SECRET_KEY: "sk_test_secretvalue",
    STRIPE_WEBHOOK_SECRET: "wrong-prefix",
    STRIPE_PRO_MONTHLY_PRICE_ID: "price_same",
    STRIPE_PRO_ANNUAL_PRICE_ID: "price_same",
    LIFEATLAS_FREE_AI_DAILY_LIMIT: "3",
    LIFEATLAS_PRO_AI_DAILY_LIMIT: "many",
  };
  const summary = evaluateEnvironment(env);
  assert.equal(summary.supabase.serviceRoleKey.status, "ok");
  assert.equal(summary.stripe.keyMode, "test");
  assert.equal(summary.stripe.webhookSecret.status, "invalid");
  assert.equal(summary.stripe.distinctPriceIds.status, "invalid");
  assert.equal(summary.ai.credential.status, "missing");
  assert.equal(summary.ai.proDailyLimit.status, "invalid");
  assert.equal(summary.clientExposure.status, "ok");
  const serialized = JSON.stringify(summary);
  for (const secret of ["anon-value", "service-role-value", "sk_test_secretvalue", "wrong-prefix"]) assert.equal(serialized.includes(secret), false);
});

test("detects secrets exposed through NEXT_PUBLIC_ variables", () => {
  assert.deepEqual(findExposedSecrets({ SUPABASE_SERVICE_ROLE_KEY: "service", NEXT_PUBLIC_COPY: "service", NEXT_PUBLIC_SUPABASE_URL: "https://x" }), ["NEXT_PUBLIC_COPY"]);
  assert.deepEqual(findExposedSecrets({ NEXT_PUBLIC_STRIPE_KEY: "sk_live_abc" }), ["NEXT_PUBLIC_STRIPE_KEY"]);
  assert.equal(stripeKeyMode("rk_live_abc"), "live");
  assert.equal(stripeKeyMode(undefined), null);
});

test("Stripe prices must match the public pricing and key mode", () => {
  const monthly = { active: true, livemode: false, currency: "usd", unit_amount: 1200, recurring: { interval: "month" } };
  assert.equal(evaluateStripePrice(monthly, "month", "test").status, "ok");
  assert.equal(evaluateStripePrice({ ...monthly, unit_amount: 7900, recurring: { interval: "year" } }, "year", "test").status, "ok");
  assert.match(evaluateStripePrice({ ...monthly, unit_amount: 1500 }, "month", "test").detail ?? "", /amount/);
  assert.match(evaluateStripePrice({ ...monthly, livemode: true }, "month", "test").detail ?? "", /live price with test key/);
  assert.match(evaluateStripePrice(monthly, "year", "test").detail ?? "", /interval/);
});

test("Stripe webhook endpoint must be enabled for every required event", () => {
  const url = "https://example.test/api/webhooks/stripe";
  const endpoint = { url, status: "enabled", enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS], livemode: false };
  assert.equal(evaluateStripeWebhookEndpoints([endpoint], url).status, "ok");
  assert.equal(evaluateStripeWebhookEndpoints([], url).status, "missing");
  assert.equal(evaluateStripeWebhookEndpoints([{ ...endpoint, status: "disabled" }], url).status, "invalid");
  assert.match(evaluateStripeWebhookEndpoints([{ ...endpoint, enabled_events: ["checkout.session.completed"] }], url).detail ?? "", /customer.subscription.deleted/);
});
