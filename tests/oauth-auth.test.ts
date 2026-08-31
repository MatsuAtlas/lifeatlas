import assert from "node:assert/strict";
import test from "node:test";

import { createPkcePair, safeAuthNext } from "../lib/auth/oauth.ts";

test("keeps OAuth return paths on the LifeAtlas origin", () => {
  assert.equal(safeAuthNext("/account?tab=billing"), "/account?tab=billing");
  assert.equal(safeAuthNext("/dashboard"), "/dashboard");
  assert.equal(safeAuthNext("//attacker.invalid"), "/dashboard");
  assert.equal(safeAuthNext("https://attacker.invalid/path"), "/dashboard");
  assert.equal(safeAuthNext(null), "/dashboard");
});

test("creates independent URL-safe PKCE verifier and challenge pairs", () => {
  const first = createPkcePair();
  const second = createPkcePair();
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.verifier, second.verifier);
  assert.notEqual(first.challenge, second.challenge);
});
