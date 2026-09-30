import type { City, CityId } from "../../types/city";

export type SupportedLanguage = "ja" | "en";

const baseEnglishLabels: Partial<Record<CityId, { name: string; country: string; region: string; climate: string; language: string }>> = {
  tokyo: { name: "Tokyo", country: "Japan", region: "Asia", climate: "Humid subtropical, four seasons", language: "Japanese" },
  osaka: { name: "Osaka", country: "Japan", region: "Asia", climate: "Humid subtropical, mild winters", language: "Japanese" },
  vancouver: { name: "Vancouver", country: "Canada", region: "North America", climate: "Oceanic, mild and rainy winters", language: "English and French" },
  toronto: { name: "Toronto", country: "Canada", region: "North America", climate: "Humid continental, four seasons", language: "English and French" },
  losAngeles: { name: "Los Angeles", country: "United States", region: "North America", climate: "Mediterranean, warm and dry", language: "English" },
  newYork: { name: "New York", country: "United States", region: "North America", climate: "Humid continental, four seasons", language: "English" },
  london: { name: "London", country: "United Kingdom", region: "Europe", climate: "Oceanic, mild winters", language: "English" },
  paris: { name: "Paris", country: "France", region: "Europe", climate: "Oceanic, mild summers", language: "French" },
  rome: { name: "Rome", country: "Italy", region: "Europe", climate: "Mediterranean, dry summers", language: "Italian" },
  queretaro: { name: "Querétaro", country: "Mexico", region: "North America", climate: "Highland, dry and mild", language: "Spanish" },
  puebla: { name: "Puebla", country: "Mexico", region: "North America", climate: "Highland, temperate", language: "Spanish" },
  merida: { name: "Mérida", country: "Mexico", region: "North America", climate: "Tropical, hot and humid", language: "Spanish" },
  mexicoCity: { name: "Mexico City", country: "Mexico", region: "North America", climate: "Highland, mild", language: "Spanish" },
  melbourne: { name: "Melbourne", country: "Australia", region: "Oceania", climate: "Oceanic, changeable temperatures", language: "English" },
};

const baseEnglishPopulations: Partial<Record<CityId, string>> = {
  tokyo: "14.2M people (Tokyo Metropolis · preliminary 2025)",
  osaka: "2.8M people (Osaka City · July 2026 estimate)",
  vancouver: "Approx. 2.6M people (Metro Vancouver · 2021 Census)",
  toronto: "Approx. 6.2M people (Toronto CMA · 2021 Census)",
  losAngeles: "3.8M people (city · 2023 estimate)",
  newYork: "8.5M people (city · 2024 estimate)",
  london: "Approx. 8.9M people (Greater London · 2023)",
  paris: "2.1M people (city · 2023)",
  rome: "Approx. 2.8M people (Roma Capitale · 2024)",
  queretaro: "1.0M people (municipality · 2020 Census)",
  puebla: "1.7M people (municipality · 2020 Census)",
  merida: "1.0M people (municipality · 2020 Census)",
  mexicoCity: "9.2M people (city · 2020 Census)",
  melbourne: "5.4M people (Greater Melbourne · June 2025)",
};

export function localizedCity(city: City, language: SupportedLanguage) {
  if (language === "ja") {
    return { name: city.name, country: city.country, region: city.region, climate: city.climate, language: city.language };
  }
  const base = baseEnglishLabels[city.id];
  return {
    name: base?.name ?? city.englishName ?? city.name,
    country: base?.country ?? city.englishCountry ?? city.country,
    region: base?.region ?? city.englishRegion ?? city.region,
    climate: base?.climate ?? city.englishClimate ?? city.climate,
    language: base?.language ?? city.englishLanguage ?? city.language,
  };
}

export function localizedPopulation(city: City, language: SupportedLanguage) {
  if (language === "ja") return city.population;
  const known = baseEnglishPopulations[city.id];
  if (known) return known;
  const tenThousands = Number(city.population.match(/([\d,.]+)万人/)?.[1]?.replace(/,/g, ""));
  if (Number.isFinite(tenThousands) && tenThousands > 0) return `Approx. ${(tenThousands / 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}M people (saved reference)`;
  const people = city.population.match(/([\d,]+)人/)?.[1];
  return people ? `${people} people (saved reference)` : "See the source coverage below";
}

export function localizedDataScope(city: City, language: SupportedLanguage) {
  if (language === "ja") return city.sourceLabel;
  const hasSavedEstimate = city.dataSources.some((source) => /Life Atlas|推定|保存参考値/i.test(source.source)) || /保存|推定|自動更新値ではありません/.test(city.sourceLabel);
  return hasSavedEstimate
    ? "Population, salary, rent or living-cost inputs include saved estimates. Tax status and each source period are shown separately."
    : "Population and tax use official sources; salary, rent and living costs use local benchmarks. Each source period is shown below.";
}

export function localizedSourceItem(item: string, language: SupportedLanguage) {
  if (language === "ja") return item;
  if (/人口/.test(item)) return "Population";
  if (/給与/.test(item)) return "Salary";
  if (/家賃/.test(item)) return "Rent";
  if (/物価/.test(item)) return "Cost of living";
  if (/所得税|税/.test(item)) return "Tax";
  if (/保険|年金|雇用/.test(item)) return "Insurance and payroll deductions";
  const readable = item.replace(/・/g, " / ").replace(/（/g, " (").replace(/）/g, ")");
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(readable) ? "Other source" : readable;
}

export function localizedUpdatedAt(updatedAt: string, language: SupportedLanguage) {
  if (language === "ja") return updatedAt;
  const match = updatedAt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : updatedAt;
}

// 出典の範囲・時期・名称の英語表記。原語の資料名（中国語・タイ語など）はそのまま残し、
// 日本語で書いた説明部分だけを英語に置き換えます。
const SOURCE_LEVEL_EN: Record<City["dataSources"][number]["level"], string> = {
  都市: "City", 都道府県: "Prefecture", 州: "State", 国: "Country", "国・州": "Country / state", "州・市": "State / city", 都市圏: "Metro area", 自治体: "Municipality",
};

export function localizedSourceLevel(level: City["dataSources"][number]["level"], language: SupportedLanguage) {
  return language === "ja" ? level : SOURCE_LEVEL_EN[level] ?? level;
}

const SOURCE_PERIOD_EN: Record<string, string> = {
  "2026年1月1日施行（寒冷累進の調整後）": "In force from 1 January 2026 (after the inflation adjustment)",
  "2026年課税期間": "Tax period 2026",
  "2025年10月1日速報": "Preliminary, 1 October 2025",
  "2026年分": "2026 income",
  "2026年度": "FY2026",
  "2025年調査": "2025 survey",
  "2023年調査": "2023 survey",
  "2026年7月1日": "1 July 2026",
  "2021年国勢調査": "2021 Census",
  "2020年国勢調査": "2020 Census",
  "2023年推計": "2023 estimate",
  "2024年推計": "2024 estimate",
  "2026-27年度": "2026–27",
  "2026年・2025年所得": "2026 (2025 income)",
  "2026年（予算法で第2段階を33%に引き下げ）": "2026 (budget law cut the second band to 33%)",
  "2024-25年度・2025年6月30日": "2024–25 · 30 June 2025",
  "2026年時点の比較用推定": "2026 comparison estimate",
  "未対応": "Not supported",
  "115年度（2026年）": "ROC year 115 (2026)",
  "2025年1月1日以降（次回改定2027年）": "From 1 January 2025 (next change 2027)",
  "2026年1月1日以降": "From 1 January 2026",
  "2025年6月末": "End of June 2025",
  "2026年第1四半期": "Q1 2026",
  "YA 2024以降": "YA 2024 onward",
  "2026年確認": "Checked 2026",
  "2025年確認": "Checked 2025",
  "2026年確認（5%）": "Checked 2026 (5%)",
  "2026/27課税年度": "2026/27 year of assessment",
  "2026/27課税年度（2026年5月13日成立）": "2026/27 year of assessment (enacted 13 May 2026)",
  "課税年度2560（2017）以降": "Tax year 2560 (2017) onward",
  "課税年度2025以降": "Tax year 2025 onward",
  "2025年10月分の給与から": "From October 2025 payroll",
  "2022年以降（UU HPP）": "2022 onward (UU HPP)",
  "2024年1月1日以降": "From 1 January 2024",
  "2026年3月1日以降": "From 1 March 2026",
  "2023年1月1日以降": "From 1 January 2023",
  "2025年以降（15%・上限₱35,000）": "2025 onward (15%, cap ₱35,000)",
  "2024年以降（月₱200）": "2024 onward (₱200 per month)",
  "2026年7月1日改定": "Revised 1 July 2026",
  "2019年以降": "2019 onward",
  "2025年度・2026年度": "FY2025 and FY2026",
  "2026年（2025年区切り×指数2.0%）": "2026 (2025 brackets × 2.0% indexation)",
  "2026課税年度": "2026 tax year",
  "2026年（AOW年齢未満）": "2026 (below AOW age)",
  "2025年10月〜2026年10月改定": "Changes October 2025 – October 2026",
  "2025年5月以降": "From May 2025",
  "2025-26年度以降（2026-27年度も据え置き）": "2025–26 onward (unchanged for 2026–27)",
  "AY 2026-27以降": "AY 2026–27 onward",
  "2026年4月1日": "1 April 2026",
  "2022年以降（2026年も同率）": "2022 onward (same rates in 2026)",
  "2026年1月1日施行の現行法（2023年以降の税率）": "Law in force from 1 January 2026 (rates since 2023)",
  "2026年1月1日施行": "In force from 1 January 2026",
  "2026年（上限は6月まで637万・7月から659万ウォン）": "2026 (cap ₩6.37m to June, ₩6.59m from July)",
  "2026年確認（施行令は2025年12月23日施行版）": "Checked 2026 (decree in force from 23 December 2025)",
  "2026年（法律73-A/2025）": "2026 (Law 73-A/2025)",
  "2026年（年金改革法は2027年4月1日施行）": "2026 (pension reform in force from 1 April 2027)",
  "2026年8月25日判決": "Ruling of 25 August 2026",
  "2026年1月分": "January 2026",
  "2024年以降": "2024 onward",
  "現行": "In force",
};

const JAPANESE_TEXT_ALL = /[\u3040-\u30ff\u3400-\u9fff]/g;

export function localizedSourcePeriod(period: string, language: SupportedLanguage) {
  if (language === "ja") return period;
  if (SOURCE_PERIOD_EN[period]) return SOURCE_PERIOD_EN[period];
  const date = period.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (date) return `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`;
  const year = period.match(/^(\d{4})年$/);
  if (year) return year[1];
  // 未登録の表記は日本語の説明を落とし、数字や原語だけを残します。
  const stripped = period.replace(/（[^）]*）/g, "").replace(/年/g, " ").replace(JAPANESE_TEXT_ALL, "").replace(/\s+/g, " ").trim();
  return stripped || "See source";
}

const SOURCE_NAME_EN: Record<string, string> = {
  "ESTV・直接連邦税の税率表2026（Form. 58c）": "Swiss Federal Tax Administration (ESTV) · Federal income tax tables 2026 (Form 58c)",
  "チューリッヒ州・税法（StG, LS 631.1）": "Canton of Zurich · Tax Act (StG, LS 631.1)",
  "チューリッヒ市・税の計算と税率": "City of Zurich · Tax calculation and tax rates",
  "ESTV・連邦の源泉税率表の計算基礎2026": "Swiss Federal Tax Administration (ESTV) · Basis for the federal withholding tax tables 2026",
  "チューリッヒ州・源泉税率表2026の計算基礎と前提": "Canton of Zurich · Withholding tax tables 2026: basis and parameters",
  "連邦保健庁（BAG）・州別の月額平均保険料2026": "Federal Office of Public Health (FOPH) · Average monthly premiums by canton 2026",
  "Life Atlas保存参考値（自動更新対象外）": "LifeAtlas saved reference values (not auto-updated)",
  "公式制度による計算未対応（結果を非表示）": "Official tax calculation not supported (results hidden)",
  "東京都・令和7年国勢調査速報": "Tokyo Metropolitan Government · 2025 Census preliminary results",
  "総務省統計局・消費者物価指数": "Statistics Bureau of Japan · Consumer Price Index",
  "厚生労働省・賃金構造基本統計調査": "Ministry of Health, Labour and Welfare · Basic Survey on Wage Structure",
  "国税庁・令和8年分源泉徴収税額表": "National Tax Agency · 2026 withholding tax tables",
  "協会けんぽ・令和8年度保険料率": "Japan Health Insurance Association · FY2026 premium rates",
  "日本年金機構・厚生年金保険料率": "Japan Pension Service · Employees' pension premium rate",
  "厚生労働省・令和8年度雇用保険料率": "Ministry of Health, Labour and Welfare · FY2026 employment insurance rates",
  "大阪市・推計人口": "Osaka City · Population estimates",
  "各州・市の税務当局": "State and city tax authorities",
  "INSEE・人口統計": "INSEE · Population statistics",
  "impots.gouv.fr・2026年税率": "impots.gouv.fr · 2026 tax rates",
  "URSSAF・民間部門の保険料率": "URSSAF · Private-sector contribution rates",
  "Roma Capitale・人口統計": "Roma Capitale · Population statistics",
  "INPS・2026年保険料資料": "INPS · 2026 contribution guidance",
  "IMSS・SUA／社会保険料": "IMSS · SUA / social security contributions",
  "Texas Comptroller・個人所得税なし": "Texas Comptroller · No personal income tax",
  "Florida Department of Revenue・個人所得税なし": "Florida Department of Revenue · No personal income tax",
  "Washington State Department of Revenue・給与への州所得税なし": "Washington State Department of Revenue · No state income tax on wages",
  "BPJS Ketenagakerjaan公式アカウント（@BPJSTKinfo）": "BPJS Ketenagakerjaan official account (@BPJSTKinfo)",
  "Social Security Office・ค่าจ้างขั้นต่ำและขั้นสูง（上限฿17,500）": "Social Security Office · ค่าจ้างขั้นต่ำและขั้นสูง (cap ฿17,500)",
  "国税庁・勤労所得の課税標準と基本税率／国家法令情報センター・所得税法第55条": "National Tax Service (Korea) · Tax base and basic rates for earned income / Korean Law Information Center · Income Tax Act Art. 55",
  "国税庁・勤労所得金額／国家法令情報センター・所得税法第47条": "National Tax Service (Korea) · Earned income amount / Korean Law Information Center · Income Tax Act Art. 47",
  "国家法令情報センター・所得税法第59条": "Korean Law Information Center · Income Tax Act Art. 59",
  "国家法令情報センター・所得税法第52条（特別所得控除）": "Korean Law Information Center · Income Tax Act Art. 52 (special income deductions)",
  "国家法令情報センター・地方税法第103条の13": "Korean Law Information Center · Local Tax Act Art. 103-13",
  "国民年金公団・年金保険料": "National Pension Service · Pension contributions",
  "国民健康保険公団・2026年度保険料率引き上げ案内": "National Health Insurance Service · 2026 premium rate notice",
  "国家法令情報センター・雇用保険及び産業災害補償保険の保険料徴収等に関する法律第13条": "Korean Law Information Center · Insurance Premium Collection Act Art. 13",
};

export function localizedSourceName(name: string, language: SupportedLanguage) {
  if (language === "ja") return name;
  return SOURCE_NAME_EN[name] ?? name.replace(/・/g, " · ").replace(/／/g, " / ").replace(/（/g, " (").replace(/）/g, ")");
}
