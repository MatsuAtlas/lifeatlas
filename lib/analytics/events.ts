export const PRODUCT_EVENTS = [
  "landing_to_analyzer",
  "analyzer_started",
  "first_scenario_created",
  "second_scenario_created",
  "analysis_completed",
  "ai_recommendation_viewed",
  "pricing_viewed",
  "upgrade_clicked",
  "subscription_completed",
  "subscription_canceled",
  "signup_completed",
  "saved_comparison",
  "share_clicked",
  "share_viewed",
  "analysis_downloaded",
] as const;

export type ProductEventName = typeof PRODUCT_EVENTS[number];

export function isProductEventName(value: unknown): value is ProductEventName {
  return typeof value === "string" && (PRODUCT_EVENTS as readonly string[]).includes(value);
}
