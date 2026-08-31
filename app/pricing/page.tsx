import type { Metadata } from "next";

import { PricingClient } from "../../components/billing/pricing-client";

export const metadata: Metadata = {
  title: "Pricing | Life Atlas",
  description: "LifeAtlas FreeとProの機能、月額・年額プランを比較できます。",
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const params = await searchParams;
  return <PricingClient canceled={params.billing === "canceled"} />;
}
