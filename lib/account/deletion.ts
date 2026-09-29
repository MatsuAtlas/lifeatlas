// アカウント削除の判断だけを切り出した純粋関数です（外部サービスへの呼び出しはルート側）。
export const ACCOUNT_DELETION_CONFIRMATION = { ja: "削除", en: "DELETE" } as const;

export function isAccountDeletionConfirmed(value: unknown) {
  return typeof value === "string" && (value.trim() === ACCOUNT_DELETION_CONFIRMATION.ja || value.trim() === ACCOUNT_DELETION_CONFIRMATION.en);
}

// Stripeの顧客を削除すると、有効な定期課金も即時に解約され、保存されたカード情報も消えます。
// 顧客IDがあるのにStripeを操作できない場合は、課金だけが残らないよう削除を止めます。
export function stripeCleanupFor(billing: { stripe_customer_id: string } | null, stripeConfigured: boolean) {
  if (!billing?.stripe_customer_id) return { action: "none" as const };
  if (!stripeConfigured) return { action: "blocked" as const };
  return { action: "deleteCustomer" as const, customerId: billing.stripe_customer_id };
}
