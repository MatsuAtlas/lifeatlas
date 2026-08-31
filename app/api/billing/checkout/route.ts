import { NextResponse } from "next/server";

import { isProStatus } from "../../../../lib/billing/entitlements";
import { readBillingRecord } from "../../../../lib/billing/subscription-server";
import { getStripeClient, getStripePriceId, isStripeCheckoutConfigured } from "../../../../lib/billing/stripe-server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../../lib/supabase-server";
import type { BillingInterval } from "../../../../types/billing";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 415 });
    }
    const body: unknown = await request.json().catch(() => null);
    const interval = body && typeof body === "object" && !Array.isArray(body) ? (body as { interval?: unknown }).interval : null;
    if (interval !== "month" && interval !== "year") return NextResponse.json({ error: "料金間隔が正しくありません。" }, { status: 400 });
    if (!isStripeCheckoutConfigured()) return NextResponse.json({ error: "アップグレードは現在準備中です。", configured: false }, { status: 503 });

    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "アップグレードするにはログインしてください。" }, { status: 401 });
    const billing = await readBillingRecord(current.user.id, current.accessToken);
    if (billing && isProStatus(billing.status)) return NextResponse.json({ error: "すでにProを利用中です。", alreadyPro: true }, { status: 409 });

    const origin = new URL(request.url).origin;
    const params = {
      mode: "subscription" as const,
      line_items: [{ price: getStripePriceId(interval as BillingInterval), quantity: 1 }],
      success_url: `${origin}/account?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?billing=canceled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto" as const,
      client_reference_id: current.user.id,
      metadata: { lifeatlas_user_id: current.user.id },
      subscription_data: { metadata: { lifeatlas_user_id: current.user.id } },
      ...(billing?.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : typeof current.user.email === "string" ? { customer_email: current.user.email } : {}),
    };
    const session = await getStripeClient().checkout.sessions.create(params);
    if (!session.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "オンライン課金は未設定です。", configured: false }, { status: 503 });
    console.error(JSON.stringify({ event: "stripe_checkout_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "購入画面を開始できませんでした。" }, { status: 502 });
  }
}
