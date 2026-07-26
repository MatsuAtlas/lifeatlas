const populationUrl = (country) =>
  `https://api.worldbank.org/v2/country/${country}/indicator/SP.POP.TOTL?format=json&per_page=100`;
const ecbUrl = (currency) =>
  `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=2020-01-01&format=csvdata`;

async function population(country) {
  const response = await fetch(populationUrl(country), { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`World Bank response ${response.status}`);
  const payload = await response.json();
  const observation = payload[1]?.find((item) => item.value !== null);
  return observation ? { value: observation.value, year: observation.date } : null;
}

async function ecbRate(currency) {
  const response = await fetch(ecbUrl(currency), { headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(`ECB response ${response.status}`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const headers = lines[0]?.split(",") ?? [];
  const valueIndex = headers.indexOf("OBS_VALUE");
  const dateIndex = headers.indexOf("TIME_PERIOD");
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const columns = lines[index].split(",");
    const value = Number(columns[valueIndex]);
    if (Number.isFinite(value) && columns[dateIndex]) return { value, date: columns[dateIndex] };
  }
  return null;
}

async function officialDataResponse() {
  const warnings = [];
  const [jpn, aus, jpy, aud] = await Promise.all([
    population("JPN").catch(() => { warnings.push("日本人口"); return null; }),
    population("AUS").catch(() => { warnings.push("豪州人口"); return null; }),
    ecbRate("JPY").catch(() => { warnings.push("円レート"); return null; }),
    ecbRate("AUD").catch(() => { warnings.push("豪ドルレート"); return null; }),
  ]);
  const audJpy = jpy && aud ? jpy.value / aud.value : null;
  const count = [jpn, aus, audJpy].filter(Boolean).length;
  return Response.json({
    sourceStatus: count === 3 ? "live" : count > 0 ? "partial" : "fallback",
    retrievedAt: new Date().toISOString(),
    populations: { JPN: jpn, AUS: aus },
    exchangeRates: { AUDJPY: audJpy, observedOn: jpy?.date === aud?.date ? jpy?.date ?? null : null },
    cityFacts: {
      tokyo: { population: { value: 14246219, period: "2025年10月1日速報" } },
      osaka: { population: { value: 2817627, period: "2026年7月1日推計" } },
      melbourne: { population: { value: 5435590, period: "2025年6月30日" } },
    },
    sources: [
      { name: "World Bank Indicators API", scope: "国全体の人口", url: "https://api.worldbank.org/v2/indicator/SP.POP.TOTL" },
      { name: "European Central Bank Data Portal", scope: "EURを基準にした為替レート", url: "https://data-api.ecb.europa.eu/service/data/EXR/" },
    ],
    warnings,
  }, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/data-refresh") return officialDataResponse();
    const assetUrl = url.pathname === "/" ? new URL("/index.html", request.url) : url;
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

export default worker;
