type OperationsEvent = "calculation_failed" | "missing_city_data" | "stale_city_data" | "external_data_source_missing";
type DetailValue = string | number | boolean | null;

function safeDetails(details: Record<string, DetailValue>) {
  return Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value]));
}

export function logOperationsEvent(level: "warn" | "error", event: OperationsEvent, details: Record<string, DetailValue> = {}) {
  const payload = JSON.stringify({ event, ...safeDetails(details), observedAt: new Date().toISOString() });
  if (level === "error") console.error(payload);
  else console.warn(payload);
}
