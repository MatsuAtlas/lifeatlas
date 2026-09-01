import assert from "node:assert/strict";
import test from "node:test";

import { applySupabaseAdminAuthHeaders } from "../lib/supabase-admin-auth.ts";

test("uses opaque Supabase secret keys only as the API key", () => {
  const headers = new Headers({ Authorization: "Bearer stale-token" });
  applySupabaseAdminAuthHeaders(headers, "sb_secret_server-only");

  assert.equal(headers.get("apikey"), "sb_secret_server-only");
  assert.equal(headers.get("Authorization"), null);
});

test("keeps legacy service role JWTs in both required headers", () => {
  const headers = new Headers({ Authorization: "Bearer stale-token" });
  applySupabaseAdminAuthHeaders(headers, "legacy-service-role-jwt");

  assert.equal(headers.get("apikey"), "legacy-service-role-jwt");
  assert.equal(headers.get("Authorization"), "Bearer legacy-service-role-jwt");
});
