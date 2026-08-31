"use client";

import { useEffect } from "react";

import { trackProductEventOnce } from "../../lib/analytics/client";
import type { ProductEventName } from "../../lib/analytics/events";

export function PageViewTracker({ event, eventKey }: { event: ProductEventName; eventKey: string }) {
  useEffect(() => {
    trackProductEventOnce(event, {}, eventKey);
  }, [event, eventKey]);
  return null;
}
