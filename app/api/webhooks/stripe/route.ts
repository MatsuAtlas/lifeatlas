import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient, getStripeWebhookSecret, isStripeWebhookConfigured } from "../../../../lib/billing/stripe-server";
import { supabaseAdminRestRequest } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function currentEventCreated(userId: string) {
  const response = await supabaseAdminRestRequest(
    `billing_subscriptions?select=last_event_created&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) throw new Error("BILLING_WEBHOOK_READ_FAILED");
  const rows: unknown = await response.json();
  const value = Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
    ? (rows[0] as { last_event_created?: unknown }).last_event_created
    : null;
  return typeof value === "number" ? value : 0;
}

async function syncSubscription(subscription: Stripe.Subscription, eventCreated: number) {
  const userId = subscription.metadata.lifeatlas_user_id;
  const customerId = objectId(subscription.customer);
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const interval = item?.price.recurring?.interval;
  if (!UUID_PATTERN.test(userId) || !customerId || !priceId || (interval !== "month" && interval !== "year")) {
    throw new Error("BILLING_WEBHOOK_SUBSCRIPTION_INVALID");
  }
  if (eventCreated < await currentEventCreated(userId)) return;

  const response = await supabaseAdminRestRequest("billing_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: priceId,
      interval,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: item.current_period_end ? new Date(item.current_period_end * 1_000).toISOString() : null,
      last_event_created: eventCreated,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error("BILLING_WEBHOOK_SAVE_FAILED");
}

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripeClient().webhooks.constructEventAsync(await request.text(), signature, getStripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) return NextResponse.json({ received: true });
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = objectId(session.subscription);
      if (session.mode === "subscription" && subscriptionId) {
        await syncSubscription(await getStripeClient().subscriptions.retrieve(subscriptionId), event.created);
      }
    } else {
      await syncSubscription(event.data.object as Stripe.Subscription, event.created);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(JSON.stringify({ event: "stripe_webhook_failed", stripeEventId: event.id, stripeEventType: event.type, errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
