import { cityOrder } from "../../data/cities.ts";
import type { CityId } from "../../types/city";

export function citySlug(cityId: CityId) {
  return cityId.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const cityBySlug = new Map(cityOrder.map((cityId) => [citySlug(cityId), cityId] as const));

export function cityIdFromSlug(slug: string) {
  return cityBySlug.get(slug) ?? null;
}

export const SEO_COMPARE_PAIRS: ReadonlyArray<readonly [CityId, CityId]> = [
  ["tokyo", "vancouver"],
  ["tokyo", "toronto"],
  ["vancouver", "melbourne"],
  ["tokyo", "singapore"],
  ["london", "dubai"],
];

export function comparisonSlug(cityA: CityId, cityB: CityId) {
  return `${citySlug(cityA)}-vs-${citySlug(cityB)}`;
}

export function comparisonFromSlug(slug: string) {
  const pair = SEO_COMPARE_PAIRS.find(([cityA, cityB]) => comparisonSlug(cityA, cityB) === slug);
  return pair ? { cityA: pair[0], cityB: pair[1] } : null;
}
