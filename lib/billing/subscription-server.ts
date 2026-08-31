import { supabaseRestRequest } from "../supabase-server.ts";
import { entitlementsForTier, tierForStatus } from "./entitlements.ts";
import type { BillingInterval, BillingStatus, BillingStatusResponse } from "../../types/billing";

export type BillingRecord = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: BillingStatus;
  price_id: string;
  interval: BillingInterval | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  last_event_created: number;
};

const BILLING_COLUMNS = "user_id,stripe_customer_id,stripe_subscription_id,status,price_id,interval,cancel_at_period_end,current_period_end,last_event_created";
const BILLING_STATUSES = new Set<BillingStatus>([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

function isBillingRecord(value: unknown): value is BillingRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.user_id === "string"
    && typeof record.stripe_customer_id === "string"
    && typeof record.stripe_subscription_id === "string"
    && typeof record.status === "string"
    && BILLING_STATUSES.has(record.status as BillingStatus)
    && typeof record.price_id === "string"
    && (record.interval === "month" || record.interval === "year" || record.interval === null)
    && typeof record.cancel_at_period_end === "boolean"
    && (typeof record.current_period_end === "string" || record.current_period_end === null)
    && typeof record.last_event_created === "number";
}

export async function readBillingRecord(userId: string, accessToken: string) {
  const response = await supabaseRestRequest(
    `billing_subscriptions?select=${BILLING_COLUMNS}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {},
    accessToken,
  );
  if (!response.ok) throw new Error("BILLING_STATUS_READ_FAILED");
  const records: unknown = await response.json();
  return Array.isArray(records) && isBillingRecord(records[0]) ? records[0] : null;
}

export function billingResponse(record: BillingRecord | null, configured: boolean): BillingStatusResponse {
  const status: BillingStatus = record?.status ?? "inactive";
  const tier = tierForStatus(status);
  return {
    configured,
    subscription: {
      tier,
      status,
      interval: record?.interval ?? null,
      cancelAtPeriodEnd: record?.cancel_at_period_end ?? false,
      currentPeriodEnd: record?.current_period_end ?? null,
    },
    entitlements: entitlementsForTier(tier),
  };
}
