import { NextResponse } from "next/server";

type ParseResult = { ok: true; value: unknown } | { ok: false; response: NextResponse };

export async function parseSameOriginJson(request: Request, maxBodyLength = 64_000): Promise<ParseResult> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { ok: false, response: NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 }) };
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 415 }) };
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyLength) {
    return { ok: false, response: NextResponse.json({ error: "送信内容が大きすぎます。" }, { status: 413 }) };
  }
  const text = await request.text();
  if (text.length > maxBodyLength) return { ok: false, response: NextResponse.json({ error: "送信内容が大きすぎます。" }, { status: 413 }) };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 400 }) };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
