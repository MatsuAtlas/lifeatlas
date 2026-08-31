import { NextResponse } from "next/server";

import { buildCatalogCoverage } from "../../../lib/data/catalog-coverage";
import { publicCityRecord } from "../../../lib/data/public-city";

export async function GET() {
  const coverage = buildCatalogCoverage();
  return NextResponse.json({ coverage: coverage.summary, cities: coverage.rows.map(publicCityRecord) }, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
