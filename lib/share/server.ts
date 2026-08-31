import { randomBytes } from "node:crypto";

import { supabaseAdminRestRequest } from "../supabase-server";
import type { PublicShareRecord, PublicShareSnapshot } from "../../types/share";

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicShareSnapshot(value: unknown): value is PublicShareSnapshot {
  if (!isObject(value) || value.version !== 1 || (value.language !== "ja" && value.language !== "en")) return false;
  return typeof value.title === "string"
    && typeof value.calculationVersion === "string"
    && typeof value.calculatedAt === "string"
    && typeof value.winnerCityId === "string"
    && typeof value.explanation === "string"
    && Array.isArray(value.scenarios)
    && value.scenarios.length >= 2
    && value.scenarios.length <= 5
    && value.scenarios.every((scenario) => isObject(scenario)
      && typeof scenario.cityId === "string"
      && typeof scenario.rank === "number"
      && typeof scenario.score === "number"
      && typeof scenario.currency === "string"
      && typeof scenario.grossAnnual === "number"
      && typeof scenario.totalLivingCostMonthly === "number"
      && isObject(scenario.dataConfidence)
      && Array.isArray(scenario.strongestFactors)
      && Array.isArray(scenario.riskFlags));
}

export function createShareId() {
  return randomBytes(12).toString("base64url");
}

export async function savePublicShare(userId: string, snapshot: PublicShareSnapshot) {
  const id = createShareId();
  const response = await supabaseAdminRestRequest("public_shares?select=id,title,language,snapshot,created_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ id, user_id: userId, title: snapshot.title, language: snapshot.language, snapshot }),
  });
  if (!response.ok) throw new Error("PUBLIC_SHARE_SAVE_FAILED");
  const rows: unknown = await response.json();
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!isObject(record) || record.id !== id) throw new Error("PUBLIC_SHARE_SAVE_INVALID");
  return id;
}

export async function readPublicShare(id: string): Promise<PublicShareRecord | null> {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const response = await supabaseAdminRestRequest(
    `public_shares?select=id,title,language,snapshot,created_at&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!response.ok) throw new Error("PUBLIC_SHARE_READ_FAILED");
  const rows: unknown = await response.json();
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!isObject(record)) return null;
  if (record.id !== id
    || typeof record.title !== "string"
    || (record.language !== "ja" && record.language !== "en")
    || typeof record.created_at !== "string"
    || !isPublicShareSnapshot(record.snapshot)) return null;
  return record as PublicShareRecord;
}
