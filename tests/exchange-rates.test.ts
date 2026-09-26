import assert from "node:assert/strict";
import test from "node:test";

import { FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import {
  calculationOptionsFor,
  fallbackExchangeRateSnapshot,
  isExchangeRateSnapshot,
  parseEcbDailyXml,
  snapshotFromEcb,
} from "../lib/data/exchange-rates.ts";
import type { ScenarioInput } from "../types/scenario.ts";

const ecbXml = `<gesmes:Envelope><Cube><Cube time='2026-09-25'>
  <Cube currency='USD' rate='1.1000'/><Cube currency='JPY' rate='165.00'/><Cube currency='CAD' rate='1.5000'/><Cube currency='SGD' rate='1.4500'/>
</Cube></Cube></gesmes:Envelope>`;

const vancouver: ScenarioInput = {
  id: "vancouver",
  cityId: "vancouver",
  annualSalary: 90_000,
  salaryCurrency: "CAD",
  age: 30,
  householdType: "single",
  children: 0,
  housing: "onebed",
  lifestyle: "balanced",
};

test("parses ECB daily rates and converts them to JPY", () => {
  const parsed = parseEcbDailyXml(ecbXml);
  assert.equal(parsed.observedOn, "2026-09-25");
  const snapshot = snapshotFromEcb(parsed);
  assert.equal(snapshot.status, "partial");
  assert.equal(snapshot.ratesToJpy.USD, 165 / 1.1);
  assert.equal(snapshot.ratesToJpy.CAD, 110);
  assert.equal(snapshot.ratesToJpy.EUR, 165);
  assert.ok(snapshot.liveCurrencies.includes("SGD"));
  // ECBに無い通貨は保存参考レートのまま、liveとしては扱いません。
  assert.equal(snapshot.ratesToJpy.AED, FALLBACK_FX_TO_JPY.AED);
  assert.equal(snapshot.liveCurrencies.includes("AED"), false);
  assert.equal(isExchangeRateSnapshot(snapshot), true);
});

test("rejects ECB payloads without a JPY rate or date", () => {
  assert.throws(() => parseEcbDailyXml("<Cube currency='USD' rate='1.1'/>"));
  assert.throws(() => parseEcbDailyXml("<Cube time='2026-09-25'><Cube currency='USD' rate='1.1'/></Cube>"));
});

test("scenario results use the shared rates and mark FX as live only for live currencies", () => {
  const snapshot = snapshotFromEcb(parseEcbDailyXml(ecbXml));
  const live = calculateScenario(vancouver, calculationOptionsFor(snapshot));
  const fallback = calculateScenario(vancouver, calculationOptionsFor(fallbackExchangeRateSnapshot()));
  assert.ok(live.dataConfidence.reasons.includes("fx:live"));
  assert.ok(fallback.dataConfidence.reasons.includes("fx:fallback"));
  assert.equal(live.annualSavingsJpy, (live.annualSavings ?? 0) * 110);
  assert.equal(fallback.annualSavingsJpy, (fallback.annualSavings ?? 0) * FALLBACK_FX_TO_JPY.CAD);
  const aedSalary = calculateScenario({ ...vancouver, annualSalary: 250_000, salaryCurrency: "AED" }, calculationOptionsFor(snapshot));
  assert.ok(aedSalary.dataConfidence.reasons.includes("fx:fallback"));
});

test("snapshot validation rejects incomplete client payloads", () => {
  const snapshot = fallbackExchangeRateSnapshot();
  assert.equal(isExchangeRateSnapshot(snapshot), true);
  assert.equal(isExchangeRateSnapshot({ ...snapshot, ratesToJpy: { ...snapshot.ratesToJpy, USD: 0 } }), false);
  assert.equal(isExchangeRateSnapshot({ ...snapshot, liveCurrencies: ["XXX"] }), false);
  assert.equal(isExchangeRateSnapshot(null), false);
});
