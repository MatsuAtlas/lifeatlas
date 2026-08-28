import type { CurrencyCode } from "../types/city";

export const FALLBACK_FX_TO_JPY: Record<CurrencyCode, number> = {
  JPY: 1,
  CAD: 108,
  USD: 145,
  GBP: 190,
  EUR: 170,
  MXN: 8.5,
  AUD: 98,
  KRW: 0.108,
  TWD: 4.55,
  SGD: 108,
  HKD: 18.6,
  THB: 4.15,
  MYR: 34,
  IDR: 0.009,
  PHP: 2.55,
  VND: 0.0058,
  CNY: 20.1,
  AED: 39.5,
  CHF: 181,
  BRL: 27,
  ARS: 0.13,
  CLP: 0.15,
  COP: 0.035,
};

export function convertCurrency(
  value: number,
  from: CurrencyCode,
  to: CurrencyCode,
  ratesToJpy: Record<CurrencyCode, number> = FALLBACK_FX_TO_JPY,
) {
  if (from === to) return value;
  return (value * ratesToJpy[from]) / ratesToJpy[to];
}
