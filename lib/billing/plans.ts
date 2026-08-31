import type { BillingInterval } from "../../types/billing";

export const PUBLIC_BILLING_PLANS = {
  month: {
    interval: "month",
    amountUsd: 12,
    label: "$12 / month",
  },
  year: {
    interval: "year",
    amountUsd: 79,
    label: "$79 / year",
  },
} as const satisfies Record<BillingInterval, { interval: BillingInterval; amountUsd: number; label: string }>;
