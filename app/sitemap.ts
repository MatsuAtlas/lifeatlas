import type { MetadataRoute } from "next";

import { cityOrder } from "../data/cities";
import { citySlug, comparisonSlug, SEO_COMPARE_PAIRS } from "../lib/seo/city-slugs";
import { siteUrl } from "../lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/analyze`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/data`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    ...cityOrder.map((city) => ({ url: `${base}/cities/${citySlug(city)}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...SEO_COMPARE_PAIRS.map(([cityA, cityB]) => ({ url: `${base}/compare/${comparisonSlug(cityA, cityB)}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.75 })),
  ];
}
