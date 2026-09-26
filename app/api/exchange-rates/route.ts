import { ECB_SOURCE_URL, getExchangeRateSnapshot } from "../../../lib/data/exchange-rates";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getExchangeRateSnapshot();
  return Response.json(
    { ...snapshot, source: { name: "European Central Bank euro reference exchange rates", url: ECB_SOURCE_URL } },
    { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" } },
  );
}
