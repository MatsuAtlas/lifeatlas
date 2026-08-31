import { NextResponse } from "next/server";

import { isSavedAnalyzerInput } from "../../../../lib/comparison-history";
import { createAIProvider, getAIModelId, AI_PROMPT_VERSION } from "../../../../lib/ai/provider";
import {
  buildRecommendationInput,
  normalizeFollowUpQuestion,
  sha256Hex,
  stableRecommendationKey,
  validateAIRecommendation,
} from "../../../../lib/ai/recommendation";
import {
  getCurrentUser,
  isSupabaseNotConfiguredError,
  supabaseRestRequest,
} from "../../../../lib/supabase-server";
import type { AIRecommendation, AIUsage, RecommendationGeneration, RecommendationLanguage } from "../../../../types/ai";
import { canUseAI } from "../../../../lib/billing/entitlements";
import { billingResponse, readBillingRecord } from "../../../../lib/billing/subscription-server";

export const dynamic = "force-dynamic";
export const maxDuration = 35;

const MAX_BODY_LENGTH = 64_000;
const DEFAULT_DAILY_LIMIT = 3;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERATION_COLUMNS = "id,context_hash,model,status,recommendation,input_tokens,output_tokens,total_tokens,created_at";

type GenerationRecord = {
  id: string;
  context_hash: string;
  model: string;
  status: "pending" | "complete" | "error";
  recommendation: unknown;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  created_at: string;
};

function dailyLimit(tier: "free" | "pro", entitlementLimit: number) {
  const environmentValue = tier === "pro" ? process.env.LIFEATLAS_PRO_AI_DAILY_LIMIT : process.env.LIFEATLAS_FREE_AI_DAILY_LIMIT;
  const configured = Number(environmentValue ?? entitlementLimit ?? DEFAULT_DAILY_LIMIT);
  return Number.isInteger(configured) && configured >= 1 && configured <= 1_000 ? configured : entitlementLimit;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGenerationRecord(value: unknown): value is GenerationRecord {
  if (!isObject(value)) return false;
  return typeof value.id === "string"
    && typeof value.context_hash === "string"
    && typeof value.model === "string"
    && (value.status === "pending" || value.status === "complete" || value.status === "error")
    && typeof value.created_at === "string";
}

function usageFromRecord(record: GenerationRecord): AIUsage {
  return {
    inputTokens: typeof record.input_tokens === "number" ? record.input_tokens : null,
    outputTokens: typeof record.output_tokens === "number" ? record.output_tokens : null,
    totalTokens: typeof record.total_tokens === "number" ? record.total_tokens : null,
  };
}

function generationResponse(record: GenerationRecord, recommendation: AIRecommendation, cached: boolean): RecommendationGeneration {
  return {
    id: record.id,
    recommendation,
    model: record.model,
    cached,
    createdAt: record.created_at,
    usage: usageFromRecord(record),
  };
}

async function readJsonBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return { error: "content-type" } as const;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) return { error: "too-large" } as const;
  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return { error: "too-large" } as const;
  try {
    return { value: JSON.parse(text) as unknown } as const;
  } catch {
    return { error: "invalid-json" } as const;
  }
}

async function cachedGeneration(userId: string, accessToken: string, contextHash: string, input: ReturnType<typeof buildRecommendationInput>) {
  const query = `ai_recommendations?select=${GENERATION_COLUMNS}&user_id=eq.${encodeURIComponent(userId)}&context_hash=eq.${contextHash}&status=eq.complete&limit=1`;
  const response = await supabaseRestRequest(query, {}, accessToken);
  if (!response.ok) throw new Error("AI_CACHE_READ_FAILED");
  const records: unknown = await response.json();
  const record = Array.isArray(records) && isGenerationRecord(records[0]) ? records[0] : null;
  return record && validateAIRecommendation(record.recommendation, input.winnerScenarioId, input.scenarios.map((scenario) => scenario.scenarioId))
    ? generationResponse(record, record.recommendation, true)
    : null;
}

async function recentGenerationCount(userId: string, accessToken: string, limit: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const query = `ai_recommendations?select=id&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since)}&limit=${limit}`;
  const response = await supabaseRestRequest(query, {}, accessToken);
  if (!response.ok) throw new Error("AI_RATE_LIMIT_READ_FAILED");
  const records: unknown = await response.json();
  return Array.isArray(records) ? records.length : limit;
}

async function createPendingGeneration(
  userId: string,
  accessToken: string,
  contextHash: string,
  model: string,
  language: RecommendationLanguage,
  question?: string,
) {
  const response = await supabaseRestRequest(
    `ai_recommendations?select=${GENERATION_COLUMNS}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        context_hash: contextHash,
        model,
        prompt_version: AI_PROMPT_VERSION,
        language,
        question: question ?? null,
        status: "pending",
      }),
    },
    accessToken,
  );
  if (!response.ok) throw new Error("AI_GENERATION_CREATE_FAILED");
  const records: unknown = await response.json();
  const record = Array.isArray(records) && isGenerationRecord(records[0]) ? records[0] : null;
  if (!record || !UUID_PATTERN.test(record.id)) throw new Error("AI_GENERATION_CREATE_INVALID");
  return record;
}

async function updateGeneration(
  recordId: string,
  userId: string,
  accessToken: string,
  update: Record<string, unknown>,
) {
  return supabaseRestRequest(
    `ai_recommendations?id=eq.${recordId}&user_id=eq.${encodeURIComponent(userId)}&select=${GENERATION_COLUMNS}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...update, updated_at: new Date().toISOString() }),
    },
    accessToken,
  );
}

function errorResponse(error: unknown) {
  if (isSupabaseNotConfiguredError(error)) {
    return NextResponse.json({ error: "AI説明の保存先が未設定です。", configured: false }, { status: 503 });
  }
  return NextResponse.json({ error: "AI説明を生成できませんでした。計算結果はそのまま利用できます。" }, { status: 502 });
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  let current: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "許可されていない送信元です。" }, { status: 403 });
    const body = await readJsonBody(request);
    if ("error" in body) return NextResponse.json({ error: body.error === "too-large" ? "送信内容が大きすぎます。" : "送信形式が正しくありません。" }, { status: body.error === "too-large" ? 413 : body.error === "content-type" ? 415 : 400 });
    if (!isObject(body.value)) return NextResponse.json({ error: "送信形式が正しくありません。" }, { status: 400 });
    current = await getCurrentUser();
    if (!current || !UUID_PATTERN.test(current.user.id)) return NextResponse.json({ error: "AI説明を利用するにはログインしてください。" }, { status: 401 });
    const billing = billingResponse(await readBillingRecord(current.user.id, current.accessToken), true);
    if (!canUseAI(billing.entitlements)) return NextResponse.json({ error: "このプランではAI説明を利用できません。", upgradeRequired: true }, { status: 403 });
    const generationLimit = dailyLimit(billing.subscription.tier, billing.entitlements.aiDailyLimit);
    if (!process.env.AI_GATEWAY_API_KEY?.trim() && !process.env.VERCEL_OIDC_TOKEN?.trim()) {
      return NextResponse.json({ error: "AI説明は現在準備中です。計算結果はそのまま利用できます。", aiConfigured: false }, { status: 503 });
    }
    const language = body.value.language;
    if (language !== "ja" && language !== "en") return NextResponse.json({ error: "言語設定が正しくありません。" }, { status: 400 });
    if (!isSavedAnalyzerInput(body.value.analysis)) return NextResponse.json({ error: "分析条件を確認できませんでした。" }, { status: 400 });
    if (body.value.analysis.scenarios.length > billing.entitlements.maxScenarios) {
      return NextResponse.json({ error: "このシナリオ数のAI説明にはProが必要です。", upgradeRequired: true }, { status: 403 });
    }
    const followUpQuestion = normalizeFollowUpQuestion(body.value.followUpQuestion);
    if (followUpQuestion === null) return NextResponse.json({ error: "質問は400文字以内で入力してください。" }, { status: 400 });

    const input = buildRecommendationInput(body.value.analysis, language, followUpQuestion);
    const model = getAIModelId();
    const contextHash = await sha256Hex(stableRecommendationKey(input, model, AI_PROMPT_VERSION));
    const cached = await cachedGeneration(current.user.id, current.accessToken, contextHash, input);
    if (cached) return NextResponse.json({ generation: cached });
    if (await recentGenerationCount(current.user.id, current.accessToken, generationLimit) >= generationLimit) {
      return NextResponse.json({ error: "AI説明の24時間上限に達しました。", limit: generationLimit }, { status: 429 });
    }

    const pending = await createPendingGeneration(current.user.id, current.accessToken, contextHash, model, language, followUpQuestion);
    generationId = pending.id;
    const generated = await createAIProvider().generateRecommendation(input);
    const updatedResponse = await updateGeneration(pending.id, current.user.id, current.accessToken, {
      status: "complete",
      recommendation: generated.recommendation,
      input_tokens: generated.usage.inputTokens,
      output_tokens: generated.usage.outputTokens,
      total_tokens: generated.usage.totalTokens,
      error_code: null,
    });
    if (!updatedResponse.ok) throw new Error("AI_GENERATION_SAVE_FAILED");
    const records: unknown = await updatedResponse.json();
    const record = Array.isArray(records) && isGenerationRecord(records[0]) ? records[0] : null;
    if (!record) throw new Error("AI_GENERATION_SAVE_INVALID");
    return NextResponse.json({ generation: generationResponse(record, generated.recommendation, false) }, { status: 201 });
  } catch (error) {
    if (generationId && current) {
      await updateGeneration(generationId, current.user.id, current.accessToken, { status: "error", error_code: "generation_failed" }).catch(() => undefined);
    }
    console.error(JSON.stringify({ event: "ai_recommendation_failed", generationId, errorName: error instanceof Error ? error.name : "UnknownError" }));
    return errorResponse(error);
  }
}
