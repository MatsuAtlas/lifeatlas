import { cities } from "../../data/cities.ts";
import { localizedCity } from "../cities/localization.ts";
import type { CatalogCoverageRow } from "./catalog-coverage.ts";

export function publicCityRecord(row: CatalogCoverageRow) {
  const city = cities[row.cityId];
  return {
    id: city.id,
    names: { ja: localizedCity(city, "ja").name, en: localizedCity(city, "en").name },
    countries: { ja: localizedCity(city, "ja").country, en: localizedCity(city, "en").country },
    currency: city.currency,
    population: city.population,
    updatedAt: city.updatedAt,
    calculationStatus: row.calculationStatus,
    dataConfidence: { level: row.confidenceLevel, score: row.confidenceScore },
    containsSavedEstimate: row.containsSavedEstimate,
    freshness: row.freshness,
    referenceInputs: {
      annualIncome: city.averageAnnualIncome,
      monthlyCosts: { ...city.costs },
    },
    sources: city.dataSources.map((source) => ({ ...source })),
    sourceScope: city.sourceLabel,
  };
}
