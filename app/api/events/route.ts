import { NextResponse } from "next/server";

import { isProductEventName } from "../../../lib/analytics/events";
import { recordProductEvent } from "../../../lib/analytics/server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProperties(value: unknown) {
  if (!isObject(value) || Object.keys(value).length > 10) return null;
  const entries = Object.entries(value);
  if (!entries.every(([key, item]) => key.length <= 40 && (item === null || ["string", "number", "boolean"].includes(typeof item)))) return null;
  if (!entries.every(([, item]) => typeof item !== "string" || item.length <= 120)) return null;
  return value as Record<string, string | number | boolean | null>;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ accepted: false }, { status: 403 });
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) return NextResponse.json({ accepted: false }, { status: 413 });
    const body: unknown = JSON.parse(text);
    if (!isObject(body) || !isProductEventName(body.event) || typeof body.anonymousId !== "string" || !UUID_PATTERN.test(body.anonymousId)) {
      return NextResponse.json({ accepted: false }, { status: 400 });
    }
    if (typeof body.pathname !== "string" || !body.pathname.startsWith("/") || body.pathname.length > 200) return NextResponse.json({ accepted: false }, { status: 400 });
    const properties = parseProperties(body.properties);
    if (!properties) return NextResponse.json({ accepted: false }, { status: 400 });
    const current = await getCurrentUser();
    await recordProductEvent({ eventName: body.event, anonymousId: body.anonymousId, userId: current?.user.id ?? null, pathname: body.pathname, properties });
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ accepted: false }, { status: 400 });
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ accepted: false, configured: false }, { status: 202 });
    console.error(JSON.stringify({ event: "analytics_event_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ accepted: false }, { status: 202 });
  }
}
