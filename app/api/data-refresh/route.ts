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

type EcbSnapshot = {
  observedOn: string;
  rates: Record<string, number>;
};

const WORLD_BANK_INDICATOR = "SP.POP.TOTL";
const CITY_COUNT = 50;
const countries = [
  "JPN", "CAN", "USA", "GBR", "FRA", "ITA", "MEX", "AUS", "KOR", "TWN", "SGP", "HKG", "THA", "MYS", "IDN", "PHL", "VNM", "CHN", "ESP", "DEU", "NLD", "PRT", "ARE", "CHE", "IRL", "BRA", "ARG", "CHL", "COL",
] as const;
const currencies = [
  "JPY", "CAD", "USD", "GBP", "EUR", "MXN", "AUD", "KRW", "TWD", "SGD", "HKD", "THB", "MYR", "IDR", "PHP", "VND", "CNY", "AED", "CHF", "BRL", "ARS", "CLP", "COP",
] as const;

const WORLD_BANK_SOURCE_URL = "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation";
const ECB_SOURCE_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

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

async function fetchEcbRates(): Promise<EcbSnapshot> {
  const response = await fetch(ECB_DAILY_URL, {
    headers: { accept: "application/xml,text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`ECB response ${response.status}`);
  const xml = await response.text();
  const observedOn = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  if (!observedOn) throw new Error("ECB observation date was not found");

  const rates: Record<string, number> = { EUR: 1 };
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const value = Number(match[2]);
    if (Number.isFinite(value)) rates[match[1]] = value;
  }
  if (!rates.JPY) throw new Error("ECB JPY rate was not found");
  return { observedOn, rates };
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
    fetchEcbRates().catch(() => {
      warnings.push("ecb:daily-rates:unavailable");
      return null;
    }),
  ]);

  const populations = Object.fromEntries(populationEntries) as Record<string, Snapshot>;
  const jpyPerEuro = ecbSnapshot?.rates.JPY ?? null;
  const exchangeRates = Object.fromEntries(currencies.map((currency) => {
    if (currency === "JPY") return [currency, 1];
    const currencyPerEuro = ecbSnapshot?.rates[currency] ?? null;
    return [currency, jpyPerEuro && currencyPerEuro ? jpyPerEuro / currencyPerEuro : null];
  })) as Record<(typeof currencies)[number], number | null>;

  const automaticCountryCount = Object.values(populations).filter(Boolean).length;
  const automaticCurrencyCount = currencies.filter((currency) => currency === "JPY" || exchangeRates[currency] !== null).length;
  const automaticItemCount = automaticCountryCount + automaticCurrencyCount;
  const expectedItemCount = countries.length + currencies.length;
  const sourceStatus = automaticItemCount === expectedItemCount ? "live" : automaticItemCount > 0 ? "partial" : "fallback";

  return Response.json({
    sourceStatus,
    retrievedAt: new Date().toISOString(),
    populations,
    exchangeRates,
    exchangeObservedOn: ecbSnapshot?.observedOn ?? null,
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
