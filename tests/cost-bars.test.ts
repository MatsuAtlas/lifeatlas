import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { calculateCity } from "../lib/calculations/legacy-engine.ts";
import { costBarWidthPercent } from "../lib/formatters.ts";

test("cost bars are hidden for zero amounts and never receive NaN or Infinity", () => {
  assert.equal(costBarWidthPercent(0, 18_000), null);
  // 両方0（どちらの都市も住居費に含む）でも0除算しません。
  assert.equal(costBarWidthPercent(0, 0), null);
  assert.equal(costBarWidthPercent(Number.NaN, 100), null);
  assert.equal(costBarWidthPercent(100, Number.POSITIVE_INFINITY), null);
  assert.equal(costBarWidthPercent(-5, 100), null);
  assert.equal(costBarWidthPercent(100, 100), 100);
  assert.equal(costBarWidthPercent(50, 100), 50);
  // 0でない小さい金額は最小8%で描きます。
  assert.equal(costBarWidthPercent(1, 1_000), 8);
});

test("utilities bars: New York vs Chicago hides both, New York vs Tokyo shows only Tokyo", () => {
  const utilitiesYen = (cityId: "newYork" | "chicago" | "tokyo") => {
    const city = cities[cityId];
    return calculateCity(city, city.averageAnnualIncome, "single", "onebed", "balanced", "under40").livingCostBreakdown.utilities * (cityId === "tokyo" ? 1 : 150);
  };
  const ny = utilitiesYen("newYork");
  const chicago = utilitiesYen("chicago");
  const tokyo = utilitiesYen("tokyo");
  assert.equal(costBarWidthPercent(ny, Math.max(ny, chicago)), null);
  assert.equal(costBarWidthPercent(chicago, Math.max(ny, chicago)), null);
  assert.equal(costBarWidthPercent(ny, Math.max(ny, tokyo)), null);
  assert.equal(costBarWidthPercent(tokyo, Math.max(ny, tokyo)), 100);
});
