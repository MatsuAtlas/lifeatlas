import Stripe from "stripe";

import type { BillingInterval } from "../../types/billing";

let stripeClient: Stripe | null = null;

export function isStripeCheckoutConfigured() {
  return Boolean(
    isStripeClientConfigured()
      && process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim()
      && process.env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim(),
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(isStripeClientConfigured() && process.env.STRIPE_WEBHOOK_SECRET?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function isStripeClientConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !key.startsWith("sk_")) throw new Error("STRIPE_NOT_CONFIGURED");
  stripeClient ??= new Stripe(key, {
    maxNetworkRetries: 2,
    timeout: 10_000,
    typescript: true,
  });
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !secret.startsWith("whsec_")) throw new Error("STRIPE_WEBHOOK_NOT_CONFIGURED");
  return secret;
}

export function getStripePriceId(interval: BillingInterval) {
  const value = interval === "month"
    ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
    : process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
  const priceId = value?.trim();
  if (!priceId || !priceId.startsWith("price_")) throw new Error("STRIPE_PRICE_NOT_CONFIGURED");
  return priceId;
}
