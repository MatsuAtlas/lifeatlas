import type { ProductEventName } from "./events";

const CLIENT_ID_KEY = "life-atlas-analytics-id";
const SESSION_EVENT_PREFIX = "life-atlas-event:";

type EventProperties = Record<string, string | number | boolean | null>;

function anonymousId() {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function trackProductEvent(event: ProductEventName, properties: EventProperties = {}) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, anonymousId: anonymousId(), pathname: window.location.pathname, properties });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function trackProductEventOnce(event: ProductEventName, properties: EventProperties = {}, key: string = event) {
  if (typeof window === "undefined") return;
  const storageKey = `${SESSION_EVENT_PREFIX}${key}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // A blocked storage API must not block product use or anonymous analytics.
  }
  trackProductEvent(event, properties);
}
