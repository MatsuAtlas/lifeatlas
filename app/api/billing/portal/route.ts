import { NextResponse } from "next/server";

import { readBillingRecord } from "../../../../lib/billing/subscription-server";
import { getStripeClient, isStripeClientConfigured } from "../../../../lib/billing/stripe-server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const originHeader = request.headers.get("origin");
    const origin = new URL(request.url).origin;
    if (originHeader && originHeader !== origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    if (!isStripeClientConfigured()) return NextResponse.json({ error: "契約管理は現在準備中です。", configured: false }, { status: 503 });
    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    const billing = await readBillingRecord(current.user.id, current.accessToken);
    if (!billing?.stripe_customer_id) return NextResponse.json({ error: "管理する契約がありません。" }, { status: 404 });
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "オンライン課金は未設定です。", configured: false }, { status: 503 });
    console.error(JSON.stringify({ event: "stripe_portal_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "契約管理画面を開始できませんでした。" }, { status: 502 });
  }
}
