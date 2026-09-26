import assert from "node:assert/strict";
import test from "node:test";

import { siteUrl } from "../lib/site-url.ts";

test("site URL prefers the explicit setting, then the Vercel production domain", () => {
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://lifeatlas.example/", VERCEL_PROJECT_PRODUCTION_URL: "lifeatlas.vercel.app" }), "https://lifeatlas.example");
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "lifeatlas.vercel.app" }), "https://lifeatlas.vercel.app");
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "http://insecure.example", VERCEL_PROJECT_PRODUCTION_URL: "lifeatlas.vercel.app" }), "https://lifeatlas.vercel.app");
  assert.equal(siteUrl({}), "https://life-atlas-global-2026.dreamy-gnat-5451.chatgpt.site");
});
