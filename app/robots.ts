import type { MetadataRoute } from "next";

import { siteUrl } from "../lib/site-url";
import { isPublicLaunch, robotsRules } from "../lib/site-visibility";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: robotsRules(),
    ...(isPublicLaunch() ? { sitemap: `${siteUrl()}/sitemap.xml` } : {}),
  };
}
