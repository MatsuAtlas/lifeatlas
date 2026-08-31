import assert from "node:assert/strict";
import test from "node:test";

import { cities } from "../data/cities.ts";
import { localizedCity } from "../lib/cities/localization.ts";

test("localizes both original and expanded city records in English", () => {
  assert.equal(localizedCity(cities.vancouver, "en").name, "Vancouver");
  assert.equal(localizedCity(cities.vancouver, "en").country, "Canada");
  assert.equal(localizedCity(cities.singapore, "en").name, "Singapore");
  assert.equal(localizedCity(cities.singapore, "en").country, "Singapore");
});
