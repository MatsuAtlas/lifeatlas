import { NextResponse } from "next/server";

import { cities } from "../../../../data/cities";
import { buildCatalogCoverage } from "../../../../lib/data/catalog-coverage";
import { publicCityRecord } from "../../../../lib/data/public-city";
import { logOperationsEvent } from "../../../../lib/observability/operations";
import { cityIdFromSlug } from "../../../../lib/seo/city-slugs";
import type { CityId } from "../../../../types/city";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cityId = (id in cities ? id : cityIdFromSlug(id)) as CityId | null;
  if (!cityId || !(cityId in cities)) {
    logOperationsEvent("warn", "missing_city_data", { endpoint: "cities", cityId: id });
    return NextResponse.json({ error: "都市が見つかりません。" }, { status: 404 });
  }
  const row = buildCatalogCoverage().rows.find((candidate) => candidate.cityId === cityId);
  if (!row) {
    logOperationsEvent("warn", "missing_city_data", { endpoint: "cities", cityId });
    return NextResponse.json({ error: "都市データが見つかりません。" }, { status: 404 });
  }
  if (row.freshness.status === "stale") logOperationsEvent("warn", "stale_city_data", { endpoint: "cities", cityId, updatedAt: row.updatedAt });
  return NextResponse.json({ city: publicCityRecord(row) }, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
