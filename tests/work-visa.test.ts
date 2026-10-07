import assert from "node:assert/strict";
import test from "node:test";

import { calculateScenario } from "../lib/calculations/calculate-scenario.ts";
import { checkWorkVisaSalary } from "../lib/calculations/work-visa.ts";
import { scoreScenarios } from "../lib/scoring/life-atlas-score.ts";
import type { ScenarioInput } from "../types/scenario.ts";

test("work visa salary thresholds match the official 2026 figures", () => {
  // 英国 Skilled Worker £41,700（GOV.UK）
  assert.equal(checkWorkVisaSalary("GBR", "GBP", 41_700, 0, 30)!.status, "meets");
  assert.equal(checkWorkVisaSalary("GBR", "GBP", 41_699, 0, 30)!.status, "below");
  // ドイツ EUブルーカード €50,700、不足職種・新卒 €45,934.20（連邦官報 BAnz AT 18.12.2025 B3）
  const de = checkWorkVisaSalary("DEU", "EUR", 48_000, 0, 30)!;
  assert.equal(de.annualThreshold, 50_700);
  assert.equal(de.status, "below");
  assert.equal(de.meetsReducedThreshold, true);
  assert.equal(checkWorkVisaSalary("DEU", "EUR", 45_000, 0, 30)!.meetsReducedThreshold, false);
  // アイルランド CSEP €68,911（重要技能リスト・学位あり €40,904）
  assert.equal(checkWorkVisaSalary("IRL", "EUR", 68_911, 0, 30)!.status, "meets");
  assert.equal(checkWorkVisaSalary("IRL", "EUR", 50_000, 0, 30)!.meetsReducedThreshold, true);
  // 豪州 Skills in Demand（Core Skills）AUD 79,423（2026年7月1日〜2027年6月30日）
  assert.equal(checkWorkVisaSalary("AUS", "AUD", 79_423, 0, 30)!.status, "meets");
  // シンガポール EP：30歳 S$7,223/月、45歳以上 S$10,700/月、23歳以下 S$5,600/月
  assert.equal(checkWorkVisaSalary("SGP", "SGD", 0, 0, 30)!.annualThreshold, 7_223 * 12);
  assert.equal(checkWorkVisaSalary("SGP", "SGD", 0, 0, 52)!.annualThreshold, 10_700 * 12);
  assert.equal(checkWorkVisaSalary("SGP", "SGD", 0, 0, 21)!.annualThreshold, 5_600 * 12);
  // フランス EUブルーカード €59,373（Service-Public.fr F16922）、Talent salarié qualifié €39,582
  const fr = checkWorkVisaSalary("FRA", "EUR", 45_000, 0, 30)!;
  assert.equal(fr.annualThreshold, 59_373);
  assert.equal(fr.status, "below");
  assert.equal(fr.meetsReducedThreshold, true);
  // スペイン EUブルーカード：INE 2024年平均€29,540.26 × 1.4、不足職種・新しい資格は0.8倍
  const es = checkWorkVisaSalary("ESP", "EUR", 35_000, 0, 30)!;
  assert.equal(es.annualThreshold, Math.round(29_540.26 * 1.4 * 100) / 100);
  assert.equal(es.reduced!.annual, Math.round(29_540.26 * 1.4 * 0.8 * 100) / 100);
  assert.equal(es.status, "below");
  assert.equal(es.meetsReducedThreshold, true);
  assert.equal(checkWorkVisaSalary("ESP", "EUR", 41_356.36, 0, 30)!.status, "meets");
  // マレーシア EPカテゴリーIII：月RM5,000の基本給。公式資料が賞与を除くと明記しているため、賞与込みでも「確認が必要」にしない
  assert.equal(checkWorkVisaSalary("MYS", "MYR", 60_000, 0, 30)!.status, "meets");
  const my = checkWorkVisaSalary("MYS", "MYR", 54_000, 10_000, 30)!;
  assert.equal(my.status, "below");
  assert.equal(my.reason, null);
  // 韓国 E-7-1 年3,112万ウォン（法務部公告 第2025-406号）
  assert.equal(checkWorkVisaSalary("KOR", "KRW", 31_120_000, 0, 30)!.status, "meets");
  assert.equal(checkWorkVisaSalary("KOR", "KRW", 30_000_000, 2_000_000, 30)!.status, "check");
  // 基準のない国・通貨が違う場合は判定しない
  assert.equal(checkWorkVisaSalary("JPN", "JPY", 5_000_000, 0, 30), null);
  assert.equal(checkWorkVisaSalary("GBR", "EUR", 50_000, 0, 30), null);
});

test("bonus-only and holiday-allowance cases are flagged for checking instead of guessed", () => {
  // 基本給は£40,000で届かず、賞与£5,000を含めると届く → 確認が必要
  const uk = checkWorkVisaSalary("GBR", "GBP", 40_000, 5_000, 30)!;
  assert.equal(uk.status, "check");
  assert.equal(uk.reason, "bonus");
  // オランダ（30歳以上・月€5,942）：年€71,304は休暇手当を含まない読み方なら満たし、含む読み方なら届かない
  const nl = checkWorkVisaSalary("NLD", "EUR", 5_942 * 12, 0, 30)!;
  assert.equal(nl.status, "check");
  assert.equal(nl.reason, "holidayAllowance");
  assert.equal(checkWorkVisaSalary("NLD", "EUR", 5_942 * 12 * 1.08, 0, 30)!.status, "meets");
  assert.equal(checkWorkVisaSalary("NLD", "EUR", 70_000, 0, 30)!.status, "below");
  // 30歳未満は月€4,357
  assert.equal(checkWorkVisaSalary("NLD", "EUR", 0, 0, 29)!.annualThreshold, 4_357 * 12);
});

test("scenario results carry the visa check and flag salaries below it without changing the score", () => {
  const base: ScenarioInput = { id: "berlin", cityId: "berlin", annualSalary: 48_000, salaryCurrency: "EUR", age: 30, householdType: "single", children: 0, housing: "onebed", lifestyle: "balanced" };
  const other: ScenarioInput = { ...base, id: "tokyo", cityId: "tokyo", annualSalary: 6_000_000, salaryCurrency: "JPY" };
  const berlin = calculateScenario(base);
  assert.equal(berlin.workVisaSalary?.status, "below");
  assert.equal(calculateScenario(other).workVisaSalary, null);
  const scores = scoreScenarios([berlin, calculateScenario(other)]);
  assert.ok(scores.find((score) => score.scenarioId === "berlin")!.riskFlags.includes("work-visa-salary-below"));
  // 賞与は基準の判定に含めない
  assert.equal(calculateScenario({ ...base, annualSalary: 48_000, bonus: 5_000 }).workVisaSalary?.status, "check");
});
