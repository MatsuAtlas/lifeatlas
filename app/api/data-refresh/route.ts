import { cityOrder } from "../../../data/cities";
import { ECB_SOURCE_URL, getExchangeRateSnapshot } from "../../../lib/data/exchange-rates";
import { logOperationsEvent } from "../../../lib/observability/operations";

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


const WORLD_BANK_INDICATOR = "SP.POP.TOTL";
const CITY_COUNT = cityOrder.length;
const countries = [
  "JPN", "CAN", "USA", "GBR", "FRA", "ITA", "MEX", "AUS", "KOR", "TWN", "SGP", "HKG", "THA", "MYS", "IDN", "PHL", "VNM", "CHN", "ESP", "DEU", "NLD", "PRT", "ARE", "CHE", "IRL", "BRA", "ARG", "CHL", "COL", "SAU", "IND",
] as const;
const currencies = [
  "JPY", "CAD", "USD", "GBP", "EUR", "MXN", "AUD", "KRW", "TWD", "SGD", "HKD", "THB", "MYR", "IDR", "PHP", "VND", "CNY", "AED", "CHF", "BRL", "ARS", "CLP", "COP", "INR", "SAR",
] as const;

const WORLD_BANK_SOURCE_URL = "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation";

const worldBankUrl = (country: string) => `https://api.worldbank.org/v2/country/${country}/indicator/${WORLD_BANK_INDICATOR}?format=json&per_page=100`;

async function fetchWorldBankPopulation(country: string): Promise<Snapshot> {
  const response = await fetch(worldBankUrl(country), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`World Bank response ${response.status}`);
  const payload = (await response.json()) as WorldBankResponse;
  const observation = payload[1]?.find((item) => item.value !== null);
  return observation?.value == null ? null : { value: observation.value, year: observation.date };
}

export async function GET() {
  const warnings: string[] = [];
  const [populationEntries, ecbSnapshot] = await Promise.all([
    Promise.all(countries.map(async (country) => [
      country,
      await fetchWorldBankPopulation(country).catch(() => {
        warnings.push(`world-bank:${country}:unavailable`);
        return null;
      }),
    ] as const)),
    getExchangeRateSnapshot(),
  ]);
  if (ecbSnapshot.status === "fallback") warnings.push("ecb:daily-rates:unavailable");

  const populations = Object.fromEntries(populationEntries) as Record<string, Snapshot>;
  // ECBで取得できなかった通貨はnullのまま返し、画面側で保存参考レートと区別します。
  const exchangeRates = Object.fromEntries(currencies.map((currency) => [
    currency,
    ecbSnapshot.liveCurrencies.includes(currency) ? ecbSnapshot.ratesToJpy[currency] : null,
  ])) as Record<(typeof currencies)[number], number | null>;

  const automaticCountryCount = Object.values(populations).filter(Boolean).length;
  const automaticCurrencyCount = currencies.filter((currency) => currency === "JPY" || exchangeRates[currency] !== null).length;
  const automaticItemCount = automaticCountryCount + automaticCurrencyCount;
  const expectedItemCount = countries.length + currencies.length;
  const sourceStatus = automaticItemCount === expectedItemCount ? "live" : automaticItemCount > 0 ? "partial" : "fallback";
  if (warnings.length > 0) logOperationsEvent("warn", "external_data_source_missing", { endpoint: "data-refresh", warningCount: warnings.length, sourceStatus });

  return Response.json({
    sourceStatus,
    retrievedAt: new Date().toISOString(),
    populations,
    exchangeRates,
    exchangeObservedOn: ecbSnapshot.observedOn,
    coverage: {
      cityCount: CITY_COUNT,
      countryCount: countries.length,
      currencyCount: currencies.length,
      automaticCountryCount,
      automaticCurrencyCount,
    },
    sources: [
      { name: "World Bank Indicators API", scope: "対象国の総人口（都市人口ではありません）", url: WORLD_BANK_SOURCE_URL },
      { name: "European Central Bank euro reference exchange rates", scope: "対応通貨を日本円へ換算するための日次為替", url: ECB_SOURCE_URL },
    ],
    warnings,
  }, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
