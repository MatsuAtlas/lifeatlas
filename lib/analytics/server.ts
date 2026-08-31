import { supabaseAdminRestRequest } from "../supabase-server";
import type { ProductEventName } from "./events";

type AnalyticsEvent = {
  eventName: ProductEventName;
  anonymousId?: string | null;
  userId?: string | null;
  pathname?: string | null;
  properties?: Record<string, string | number | boolean | null>;
  sourceEventId?: string | null;
};

export async function recordProductEvent(event: AnalyticsEvent) {
  const response = await supabaseAdminRestRequest(event.sourceEventId ? "analytics_events?on_conflict=source_event_id" : "analytics_events", {
    method: "POST",
    headers: { Prefer: event.sourceEventId ? "resolution=ignore-duplicates,return=minimal" : "return=minimal" },
    body: JSON.stringify({
      event_name: event.eventName,
      anonymous_id: event.anonymousId ?? null,
      user_id: event.userId ?? null,
      pathname: event.pathname ?? null,
      properties: event.properties ?? {},
      source_event_id: event.sourceEventId ?? null,
    }),
  });
  if (!response.ok) throw new Error("ANALYTICS_EVENT_SAVE_FAILED");
}
