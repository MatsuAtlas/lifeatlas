import { FALLBACK_FX_TO_JPY } from "../../data/currencies.ts";
import type { CurrencyCode } from "../../types/city";
import type { ScenarioCalculationOptions } from "../../types/scenario";

// ホーム・Offer Analyzer・計算API・AI説明が同じ為替を使うための共通モジュールです。
// ECBに無い通貨（AED、TWD、VNDなど）は保存済みの参考レートで補い、liveCurrenciesで区別します。

export const ECB_SOURCE_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const LIVE_CACHE_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_MS = 10 * 60 * 1000;

export type EcbDailyRates = { observedOn: string; rates: Record<string, number> };

export type ExchangeRateSnapshot = {
  status: "live" | "partial" | "fallback";
  observedOn: string | null;
  ratesToJpy: Record<CurrencyCode, number>;
  liveCurrencies: CurrencyCode[];
};

const supportedCurrencies = Object.keys(FALLBACK_FX_TO_JPY) as CurrencyCode[];

export function parseEcbDailyXml(xml: string): EcbDailyRates {
  const observedOn = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  if (!observedOn) throw new Error("ECB observation date was not found");
  const rates: Record<string, number> = { EUR: 1 };
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const value = Number(match[2]);
    if (Number.isFinite(value) && value > 0) rates[match[1]] = value;
  }
  if (!rates.JPY) throw new Error("ECB JPY rate was not found");
  return { observedOn, rates };
}

export function fallbackExchangeRateSnapshot(): ExchangeRateSnapshot {
  return { status: "fallback", observedOn: null, ratesToJpy: { ...FALLBACK_FX_TO_JPY }, liveCurrencies: ["JPY"] };
}

export function snapshotFromEcb(ecb: EcbDailyRates): ExchangeRateSnapshot {
  const jpyPerEuro = ecb.rates.JPY;
  const ratesToJpy = { ...FALLBACK_FX_TO_JPY };
  const liveCurrencies: CurrencyCode[] = [];
  for (const currency of supportedCurrencies) {
    if (currency === "JPY") {
      liveCurrencies.push(currency);
      continue;
    }
    const currencyPerEuro = ecb.rates[currency];
    if (currencyPerEuro) {
      ratesToJpy[currency] = jpyPerEuro / currencyPerEuro;
      liveCurrencies.push(currency);
    }
  }
  return {
    status: liveCurrencies.length === supportedCurrencies.length ? "live" : "partial",
    observedOn: ecb.observedOn,
    ratesToJpy,
    liveCurrencies,
  };
}

export async function fetchEcbDailyRates(): Promise<EcbDailyRates> {
  const response = await fetch(ECB_DAILY_URL, {
    headers: { accept: "application/xml,text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`ECB response ${response.status}`);
  return parseEcbDailyXml(await response.text());
}

let cached: { snapshot: ExchangeRateSnapshot; expiresAt: number } | null = null;
let pending: Promise<ExchangeRateSnapshot> | null = null;

export async function getExchangeRateSnapshot(now = Date.now()): Promise<ExchangeRateSnapshot> {
  if (cached && cached.expiresAt > now) return cached.snapshot;
  pending ??= fetchEcbDailyRates()
    .then((ecb) => {
      const snapshot = snapshotFromEcb(ecb);
      cached = { snapshot, expiresAt: Date.now() + LIVE_CACHE_MS };
      return snapshot;
    })
    .catch(() => {
      const snapshot = fallbackExchangeRateSnapshot();
      cached = { snapshot, expiresAt: Date.now() + FAILURE_CACHE_MS };
      return snapshot;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function calculationOptionsFor(snapshot: Pick<ExchangeRateSnapshot, "ratesToJpy" | "liveCurrencies">): ScenarioCalculationOptions {
  return { ratesToJpy: { ...snapshot.ratesToJpy }, liveCurrencies: [...snapshot.liveCurrencies] };
}

export function isExchangeRateSnapshot(value: unknown): value is ExchangeRateSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExchangeRateSnapshot>;
  return (candidate.status === "live" || candidate.status === "partial" || candidate.status === "fallback")
    && (candidate.observedOn === null || typeof candidate.observedOn === "string")
    && Array.isArray(candidate.liveCurrencies)
    && candidate.liveCurrencies.every((currency) => supportedCurrencies.includes(currency))
    && !!candidate.ratesToJpy
    && typeof candidate.ratesToJpy === "object"
    && supportedCurrencies.every((currency) => {
      const rate = (candidate.ratesToJpy as Record<string, unknown>)[currency];
      return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
    });
}
