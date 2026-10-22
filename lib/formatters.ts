import type { CurrencyCode } from "../types/city";
import type { SupportedLanguage } from "./cities/localization";

export function formatCurrency(value: number | null, currency: CurrencyCode, language: SupportedLanguage) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

// ホームの生活費の内訳の棒の幅（%）。金額が0以下・計算不能、または比較相手と合わせて0の場合は null（棒を表示しない）。
// 0でない金額は見分けられるよう最小8%で描きます。
export function costBarWidthPercent(value: number, max: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(max) || value <= 0 || max <= 0) return null;
  return Math.min(100, Math.max(8, (value / max) * 100));
}
