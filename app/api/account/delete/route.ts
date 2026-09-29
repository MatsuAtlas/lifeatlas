import { NextResponse } from "next/server";

import { isAccountDeletionConfirmed, stripeCleanupFor } from "../../../../lib/account/deletion";
import { readBillingRecord } from "../../../../lib/billing/subscription-server";
import { getStripeClient, isStripeClientConfigured } from "../../../../lib/billing/stripe-server";
import { clearSessionCookies, getCurrentUser, isSupabaseNotConfiguredError, supabaseAdminAuthRequest } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ログイン中の本人のアカウントだけを削除します。比較履歴・プロフィール・AI履歴・共有リンク・契約情報は
// auth.users の削除に連動して消え（on delete cascade）、利用状況の記録は user_id が null になります。
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
  try {
    const body: unknown = await request.json().catch(() => null);
    const confirmation = body && typeof body === "object" ? (body as { confirm?: unknown }).confirm : null;
    if (!isAccountDeletionConfirmed(confirmation)) return NextResponse.json({ error: "確認のため「削除」と入力してください。" }, { status: 400 });

    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
    const userId: string = current.user.id;
    if (!UUID_PATTERN.test(userId)) return NextResponse.json({ error: "アカウントを確認できませんでした。" }, { status: 400 });

    const billing = await readBillingRecord(userId, current.accessToken);
    const stripe = stripeCleanupFor(billing, isStripeClientConfigured());
    if (stripe.action === "blocked") {
      return NextResponse.json({ error: "課金情報を安全に解約できないため、現在アカウントを削除できません。時間をおいて再度お試しください。" }, { status: 503 });
    }
    if (stripe.action === "deleteCustomer") {
      try {
        await getStripeClient().customers.del(stripe.customerId);
      } catch (error) {
        const alreadyDeleted = typeof error === "object" && error !== null && (error as { code?: unknown }).code === "resource_missing";
        if (!alreadyDeleted) throw error;
      }
    }

    const response = await supabaseAdminAuthRequest(`users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("ACCOUNT_DELETE_FAILED");

    const output = NextResponse.json({ deleted: true });
    clearSessionCookies(output);
    return output;
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ error: "アカウント機能は現在準備中です。", configured: false }, { status: 503 });
    console.error(JSON.stringify({ event: "account_delete_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "アカウントを削除できませんでした。時間をおいて再度お試しください。" }, { status: 502 });
  }
}
