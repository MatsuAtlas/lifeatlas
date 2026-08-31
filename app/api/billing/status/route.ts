import { NextResponse } from "next/server";

import { billingResponse, readBillingRecord } from "../../../../lib/billing/subscription-server";
import { isStripeCheckoutConfigured } from "../../../../lib/billing/stripe-server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    const record = await readBillingRecord(current.user.id, current.accessToken);
    return NextResponse.json(billingResponse(record, isStripeCheckoutConfigured()));
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) {
      return NextResponse.json({ error: "オンライン課金は未設定です。", configured: false }, { status: 503 });
    }
    return NextResponse.json({ error: "契約状態を確認できませんでした。" }, { status: 503 });
  }
}
