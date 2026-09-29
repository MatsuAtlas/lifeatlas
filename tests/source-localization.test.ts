import assert from "node:assert/strict";
import test from "node:test";

import { cities, cityOrder } from "../data/cities.ts";
import { localizedSourceItem, localizedSourceLevel, localizedSourceName, localizedSourcePeriod } from "../lib/cities/localization.ts";

const kana = /[぀-ヿ]/;
const han = /[㐀-鿿]/;

test("English source labels never show Japanese text for any city", () => {
  for (const cityId of cityOrder) {
    const city = cities[cityId];
    // 中国・台湾の資料名は原語（漢字）のまま示すため、名称の漢字チェックはそれ以外の都市に限ります。
    const originalTitlesInChinese = ["CHN", "TWN"].includes(city.countryCode);
    for (const source of city.dataSources) {
      const period = localizedSourcePeriod(source.period, "en");
      const name = localizedSourceName(source.source, "en");
      assert.equal(kana.test(period) || han.test(period), false, `${cityId} period: ${period}`);
      assert.equal(kana.test(name), false, `${cityId} source: ${name}`);
      if (!originalTitlesInChinese) assert.equal(han.test(name), false, `${cityId} source: ${name}`);
      assert.equal(han.test(localizedSourceLevel(source.level, "en")), false);
      assert.equal(kana.test(localizedSourceItem(source.item, "en")) || han.test(localizedSourceItem(source.item, "en")), false, `${cityId} item: ${source.item}`);
    }
  }
});

test("Japanese labels are returned unchanged", () => {
  assert.equal(localizedSourcePeriod("2026年確認", "ja"), "2026年確認");
  assert.equal(localizedSourceName("総務省統計局・消費者物価指数", "ja"), "総務省統計局・消費者物価指数");
  assert.equal(localizedSourcePeriod("2026年7月1日", "en"), "1 July 2026");
  assert.equal(localizedSourceName("GOV.UK・National Insurance", "en"), "GOV.UK · National Insurance");
});
