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

export type OneTimeProduct = {
  kind: "one-time";
  availability: "planned" | "available";
  targetAmountUsd: readonly [number, number];
};

export const PUBLIC_ONE_TIME_PRODUCTS = {
  decisionReport: {
    kind: "one-time",
    availability: "planned",
    targetAmountUsd: [39, 49],
  },
} as const satisfies Record<string, OneTimeProduct>;
