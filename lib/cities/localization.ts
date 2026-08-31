import type { City, CityId } from "../../types/city";

export type SupportedLanguage = "ja" | "en";

const baseEnglishLabels: Partial<Record<CityId, { name: string; country: string; region: string; climate: string; language: string }>> = {
  tokyo: { name: "Tokyo", country: "Japan", region: "Asia", climate: "Humid subtropical, four seasons", language: "Japanese" },
  osaka: { name: "Osaka", country: "Japan", region: "Asia", climate: "Humid subtropical, mild winters", language: "Japanese" },
  vancouver: { name: "Vancouver", country: "Canada", region: "North America", climate: "Oceanic, mild and rainy winters", language: "English and French" },
  toronto: { name: "Toronto", country: "Canada", region: "North America", climate: "Humid continental, four seasons", language: "English and French" },
  losAngeles: { name: "Los Angeles", country: "United States", region: "North America", climate: "Mediterranean, warm and dry", language: "English" },
  newYork: { name: "New York", country: "United States", region: "North America", climate: "Humid continental, four seasons", language: "English" },
  london: { name: "London", country: "United Kingdom", region: "Europe", climate: "Oceanic, mild winters", language: "English" },
  paris: { name: "Paris", country: "France", region: "Europe", climate: "Oceanic, mild summers", language: "French" },
  rome: { name: "Rome", country: "Italy", region: "Europe", climate: "Mediterranean, dry summers", language: "Italian" },
  queretaro: { name: "Querétaro", country: "Mexico", region: "North America", climate: "Highland, dry and mild", language: "Spanish" },
  puebla: { name: "Puebla", country: "Mexico", region: "North America", climate: "Highland, temperate", language: "Spanish" },
  merida: { name: "Mérida", country: "Mexico", region: "North America", climate: "Tropical, hot and humid", language: "Spanish" },
  mexicoCity: { name: "Mexico City", country: "Mexico", region: "North America", climate: "Highland, mild", language: "Spanish" },
  melbourne: { name: "Melbourne", country: "Australia", region: "Oceania", climate: "Oceanic, changeable temperatures", language: "English" },
};

const baseEnglishPopulations: Partial<Record<CityId, string>> = {
  tokyo: "14.2M people (Tokyo Metropolis · preliminary 2025)",
  osaka: "2.8M people (Osaka City · July 2026 estimate)",
  vancouver: "Approx. 2.6M people (Metro Vancouver · 2021 Census)",
  toronto: "Approx. 6.2M people (Toronto CMA · 2021 Census)",
  losAngeles: "3.8M people (city · 2023 estimate)",
  newYork: "8.5M people (city · 2024 estimate)",
  london: "Approx. 8.9M people (Greater London · 2023)",
  paris: "2.1M people (city · 2023)",
  rome: "Approx. 2.8M people (Roma Capitale · 2024)",
  queretaro: "1.0M people (municipality · 2020 Census)",
  puebla: "1.7M people (municipality · 2020 Census)",
  merida: "1.0M people (municipality · 2020 Census)",
  mexicoCity: "9.2M people (city · 2020 Census)",
  melbourne: "5.4M people (Greater Melbourne · June 2025)",
};

export function localizedCity(city: City, language: SupportedLanguage) {
  if (language === "ja") {
    return { name: city.name, country: city.country, region: city.region, climate: city.climate, language: city.language };
  }
  const base = baseEnglishLabels[city.id];
  return {
    name: base?.name ?? city.englishName ?? city.name,
    country: base?.country ?? city.englishCountry ?? city.country,
    region: base?.region ?? city.englishRegion ?? city.region,
    climate: base?.climate ?? city.englishClimate ?? city.climate,
    language: base?.language ?? city.englishLanguage ?? city.language,
  };
}

export function localizedPopulation(city: City, language: SupportedLanguage) {
  if (language === "ja") return city.population;
  const known = baseEnglishPopulations[city.id];
  if (known) return known;
  const tenThousands = Number(city.population.match(/([\d,.]+)万人/)?.[1]?.replace(/,/g, ""));
  if (Number.isFinite(tenThousands) && tenThousands > 0) return `Approx. ${(tenThousands / 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}M people (saved reference)`;
  const people = city.population.match(/([\d,]+)人/)?.[1];
  return people ? `${people} people (saved reference)` : "See the source coverage below";
}

export function localizedDataScope(city: City, language: SupportedLanguage) {
  if (language === "ja") return city.sourceLabel;
  const hasSavedEstimate = city.dataSources.some((source) => /Life Atlas|推定|保存参考値/i.test(source.source)) || /保存|推定|自動更新値ではありません/.test(city.sourceLabel);
  return hasSavedEstimate
    ? "Population, salary, rent or living-cost inputs include saved estimates. Tax status and each source period are shown separately."
    : "Population and tax use official sources; salary, rent and living costs use local benchmarks. Each source period is shown below.";
}

export function localizedSourceItem(item: string, language: SupportedLanguage) {
  if (language === "ja") return item;
  if (/人口/.test(item)) return "Population";
  if (/給与/.test(item)) return "Salary";
  if (/家賃/.test(item)) return "Rent";
  if (/物価/.test(item)) return "Cost of living";
  if (/所得税|税/.test(item)) return "Tax";
  if (/保険|年金|雇用/.test(item)) return "Insurance and payroll deductions";
  return item;
}

export function localizedUpdatedAt(updatedAt: string, language: SupportedLanguage) {
  if (language === "ja") return updatedAt;
  const match = updatedAt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : updatedAt;
}
