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
