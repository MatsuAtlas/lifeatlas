import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_USER_PROFILE, isUserProfile, profileFromRow } from "../lib/user-profile.ts";

test("validates complete profile defaults and rejects unsupported values", () => {
  assert.equal(isUserProfile(DEFAULT_USER_PROFILE), true);
  assert.equal(isUserProfile({ ...DEFAULT_USER_PROFILE, age: 17 }), false);
  assert.equal(isUserProfile({ ...DEFAULT_USER_PROFILE, currentCity: "unknown" }), false);
  assert.equal(isUserProfile({ ...DEFAULT_USER_PROFILE, baseCurrency: "BTC" }), false);
  assert.equal(isUserProfile({ ...DEFAULT_USER_PROFILE, priorities: { ...DEFAULT_USER_PROFILE.priorities, savings: 9 } }), false);
});

test("maps a user-scoped database row onto the public profile shape", () => {
  const profile = profileFromRow({
    age: 34,
    household_type: "couple",
    children: 2,
    base_currency: "CAD",
    current_city: "vancouver",
    priorities: { ...DEFAULT_USER_PROFILE.priorities, family: 5 },
    updated_at: "2026-08-31T00:00:00.000Z",
  });
  assert.ok(profile);
  assert.equal(profile.currentCity, "vancouver");
  assert.equal(profile.priorities.family, 5);
  assert.equal(Object.hasOwn(profile, "userId"), false);
});
