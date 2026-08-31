import { cities, cityOrder } from "../../data/cities.ts";
import { calculateScenario } from "../calculations/calculate-scenario.ts";
import type { CityId } from "../../types/city";
import type { TaxCalculationStatus } from "../../types/finance";

export type FreshnessStatus = "current" | "review" | "stale" | "unknown";

function parseCatalogDate(value: string) {
  const japanese = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const normalized = japanese ? `${japanese[1]}-${japanese[2].padStart(2, "0")}-${japanese[3].padStart(2, "0")}T00:00:00Z` : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function assessCatalogFreshness(updatedAt: string, now = new Date()) {
  const updated = parseCatalogDate(updatedAt);
  if (!updated) return { status: "unknown" as const, ageDays: null };
  const ageDays = Math.max(0, Math.floor((now.getTime() - updated.getTime()) / 86_400_000));
  const status: FreshnessStatus = ageDays <= 180 ? "current" : ageDays <= 365 ? "review" : "stale";
  return { status, ageDays };
}

export type CatalogCoverageRow = {
  cityId: CityId;
  calculationStatus: TaxCalculationStatus;
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
  containsSavedEstimate: boolean;
  updatedAt: string;
  freshness: ReturnType<typeof assessCatalogFreshness>;
};

export function buildCatalogCoverage(now = new Date()) {
  const rows: CatalogCoverageRow[] = cityOrder.map((cityId) => {
    const city = cities[cityId];
    const result = calculateScenario({
      id: `coverage-${cityId}`,
      cityId,
      annualSalary: city.averageAnnualIncome,
      salaryCurrency: city.currency,
      age: 30,
      householdType: "single",
      children: 0,
      housing: "onebed",
      lifestyle: "balanced",
    });
    return {
      cityId,
      calculationStatus: result.calculationStatus,
      confidenceLevel: result.dataConfidence.level,
      confidenceScore: result.dataConfidence.score,
      containsSavedEstimate: city.dataSources.some((source) => /Life Atlas|推定|保存参考値/i.test(source.source)) || /保存|推定|自動更新値ではありません/.test(city.sourceLabel),
      updatedAt: city.updatedAt,
      freshness: assessCatalogFreshness(city.updatedAt, now),
    };
  });

  return {
    rows,
    summary: {
      cityCount: rows.length,
      calculationAvailable: rows.filter((row) => row.calculationStatus !== "unavailable").length,
      calculationUnavailable: rows.filter((row) => row.calculationStatus === "unavailable").length,
      highConfidence: rows.filter((row) => row.confidenceLevel === "high").length,
      mediumConfidence: rows.filter((row) => row.confidenceLevel === "medium").length,
      lowConfidence: rows.filter((row) => row.confidenceLevel === "low").length,
      containsSavedEstimate: rows.filter((row) => row.containsSavedEstimate).length,
      stale: rows.filter((row) => row.freshness.status === "stale").length,
    },
  };
}
