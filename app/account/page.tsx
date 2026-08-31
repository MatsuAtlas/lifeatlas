import type { Metadata } from "next";

import { AccountClient } from "../../components/billing/account-client";

export const metadata: Metadata = {
  title: "Account | Life Atlas",
  description: "LifeAtlasのアカウント、保存した分析、Pro契約を管理します。",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ billing?: string; auth?: string }> }) {
  const params = await searchParams;
  return <AccountClient checkoutReturned={params.billing === "success"} authStatus={params.auth} />;
}
