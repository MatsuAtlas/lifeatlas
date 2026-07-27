type WorldBankObservation = {
  date: string;
  value: number | null;
};

type WorldBankResponse = [
  { page: number; pages: number; per_page: string; total: number },
  WorldBankObservation[],
];

type Snapshot = {
  value: number;
  year: string;
} | null;

type ExchangeSnapshot = {
  value: number;
  date: string;
} | null;

const WORLD_BANK_INDICATOR = "SP.POP.TOTL";
const countries = ["JPN", "CAN", "USA", "GBR", "FRA", "ITA", "MEX", "AUS"] as const;
const currencies = ["CAD", "USD", "GBP", "EUR", "MXN", "AUD", "JPY"] as const;

const worldBankUrl = (country: string) => `https://api.worldbank.org/v2/country/${country}/indicator/${WORLD_BANK_INDICATOR}?format=json&per_page=100`;
const ecbUrl = (currency: string) => `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=2020-01-01&format=csvdata`;

const cityFacts = {
  tokyo: { population: { value: 14_246_219, period: "東京都・2025年10月1日速報" }, sources: [] },
  osaka: { population: { value: 2_817_627, period: "大阪市・2026年7月1日推計" }, sources: [] },
  vancouver: { population: { value: 2_642_825, period: "Metro Vancouver・2021年国勢調査" }, sources: [] },
  toronto: { population: { value: 6_202_225, period: "Toronto CMA・2021年国勢調査" }, sources: [] },
  losAngeles: { population: { value: 3_820_914, period: "市・2023年推計" }, sources: [] },
  newYork: { population: { value: 8_478_072, period: "市・2024年推計" }, sources: [] },
  london: { population: { value: 8_900_000, period: "Greater London・2023年" }, sources: [] },
  paris: { population: { value: 2_103_778, period: "市・2023年" }, sources: [] },
  rome: { population: { value: 2_800_000, period: "Roma Capitale・2024年" }, sources: [] },
  queretaro: { population: { value: 1_049_777, period: "自治体・2020年国勢調査" }, sources: [] },
  puebla: { population: { value: 1_692_181, period: "自治体・2020年国勢調査" }, sources: [] },
  merida: { population: { value: 995_129, period: "自治体・2020年国勢調査" }, sources: [] },
  mexicoCity: { population: { value: 9_209_944, period: "市・2020年国勢調査" }, sources: [] },
  melbourne: { population: { value: 5_435_590, period: "Greater Melbourne・2025年6月30日" }, sources: [] },
};

async function fetchWorldBankPopulation(country: string): Promise<Snapshot> {
  const response = await fetch(worldBankUrl(country), { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`World Bank response ${response.status}`);
  const payload = (await response.json()) as WorldBankResponse;
  const observation = payload[1]?.find((item) => item.value !== null);
  return observation?.value == null ? null : { value: observation.value, year: observation.date };
}

async function fetchEcbRate(currency: string): Promise<ExchangeSnapshot> {
  if (currency === "EUR") return { value: 1, date: new Date().toISOString().slice(0, 10) };
  const response = await fetch(ecbUrl(currency), { headers: { accept: "text/csv" }, cache: "no-store" });
  if (!response.ok) throw new Error(`ECB response ${response.status}`);
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const valueIndex = header.indexOf("OBS_VALUE");
  const dateIndex = header.indexOf("TIME_PERIOD");
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const columns = lines[index].split(",");
    const value = Number(columns[valueIndex]);
    const date = columns[dateIndex];
    if (Number.isFinite(value) && date) return { value, date };
  }
  return null;
}

export async function GET() {
  const warnings: string[] = [];
  const populationEntries = await Promise.all(countries.map(async (country) => [country, await fetchWorldBankPopulation(country).catch(() => { warnings.push(`World Bankの${country}人口を取得できませんでした。`); return null; })] as const));
  const rateEntries = await Promise.all(currencies.map(async (currency) => [currency, await fetchEcbRate(currency).catch(() => { warnings.push(`ECBの${currency}レートを取得できませんでした。`); return null; })] as const));
  const populations = Object.fromEntries(populationEntries) as Record<string, Snapshot>;
  const rates = Object.fromEntries(rateEntries) as Record<string, ExchangeSnapshot>;
  const jpyPerEuro = rates.JPY?.value ?? null;
  const exchangeRates = Object.fromEntries(currencies.map((currency) => [currency, currency === "JPY" ? 1 : jpyPerEuro && rates[currency]?.value ? jpyPerEuro / rates[currency]!.value : null]));
  const successfulPopulationCount = Object.values(populations).filter(Boolean).length;
  const successfulRateCount = Object.values(exchangeRates).filter((value) => typeof value === "number").length;
  const sourceCount = successfulPopulationCount + successfulRateCount;
  const sourceStatus = sourceCount >= 12 ? "live" : sourceCount > 0 ? "partial" : "fallback";

  return Response.json({
    sourceStatus,
    retrievedAt: new Date().toISOString(),
    populations,
    exchangeRates,
    exchangeObservedOn: rates.JPY?.date ?? null,
    cityFacts,
    sources: [
      { name: "World Bank Indicators API", scope: "各国の人口", url: `https://api.worldbank.org/v2/country/${countries.join(";")}/indicator/${WORLD_BANK_INDICATOR}?format=json` },
      { name: "European Central Bank Data Portal", scope: "各通貨を日本円へ換算するための為替", url: "https://data-api.ecb.europa.eu/service/data/EXR/" },
    ],
    warnings,
  }, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
