import type { Metadata } from "next";
import Link from "next/link";

import { cities } from "../../data/cities";
import { localizedCity, localizedUpdatedAt } from "../../lib/cities/localization";
import { buildCatalogCoverage } from "../../lib/data/catalog-coverage";
import { citySlug } from "../../lib/seo/city-slugs";

export const metadata: Metadata = {
  title: "Data coverage and freshness | Life Atlas",
  description: "LifeAtlas 50都市の出典範囲、計算対応、保存推定値、確認日、データ信頼度を公開します。",
};

export default async function DataPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const en = lang === "en";
  const { rows, summary } = buildCatalogCoverage();
  const status = (value: (typeof rows)[number]["calculationStatus"]) => value === "official-scenario"
    ? (en ? "Official scenario" : "公式条件で計算")
    : value === "official-rate-estimate" ? (en ? "Official-rate estimate" : "公式税率の概算") : (en ? "Financial result unavailable" : "金額計算は未対応");
  const confidence = (value: (typeof rows)[number]["confidenceLevel"]) => value === "high" ? (en ? "High" : "高") : value === "medium" ? (en ? "Medium" : "中") : (en ? "Low" : "低");
  const freshness = (value: (typeof rows)[number]["freshness"]["status"]) => value === "current" ? (en ? "Reviewed within 180 days" : "180日以内にカタログ確認") : value === "review" ? (en ? "Review due" : "再確認時期") : value === "stale" ? (en ? "Stale" : "古い可能性") : (en ? "Date unavailable" : "確認日不明");

  return <main className="growth-page reference-page">
    <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Analyzer</Link><Link href={`/methodology${en ? "?lang=en" : ""}`}>Method</Link><Link href={en ? "/data" : "/data?lang=en"}>{en ? "日本語" : "English"}</Link></nav></header>
    <section className="growth-hero reference-hero"><p className="eyebrow">DATA COVERAGE</p><h1>{en ? "Know what each number can—and cannot—say." : "その数字が、どこまで言えるかを明示します。"}</h1><p>{en ? "LifeAtlas covers 50 cities, but does not pretend every input has equal precision. This page separates supported calculations, saved estimates, source periods and catalog-review dates." : "LifeAtlasは50都市を扱いますが、すべての値を同じ精度には見せません。計算対応、保存推定値、各出典の参照期間、カタログ確認日を分けて表示します。"}</p></section>
    <section className="reference-summary-grid">
      <div><strong>{summary.cityCount}</strong><span>{en ? "cities" : "対象都市"}</span></div>
      <div><strong>{summary.calculationAvailable}</strong><span>{en ? "financial calculations available" : "金額計算に対応"}</span></div>
      <div><strong>{summary.calculationUnavailable}</strong><span>{en ? "financial calculations unavailable" : "金額計算は未対応"}</span></div>
      <div><strong>{summary.containsSavedEstimate}</strong><span>{en ? "include saved estimates" : "保存推定値を含む"}</span></div>
    </section>
    <aside className="growth-note reference-warning"><strong>{en ? "How to read this page" : "このページの読み方"}</strong><p>{en ? "The review date records when the LifeAtlas catalog entry was checked; it is not the publication date of every source. Open each city page to see source-specific coverage and periods. Exchange rates can be refreshed separately from saved city baselines." : "確認日はLifeAtlasのカタログ項目を確認した日であり、すべての出典の公表日ではありません。各都市ページで項目別の対象範囲と参照期間を確認できます。為替の更新と、保存された都市基準値の更新は別です。"}</p></aside>
    <section className="growth-section reference-section"><div className="growth-section-heading"><div><p className="eyebrow">50-CITY INVENTORY</p><h2>{en ? "Calculation and source coverage" : "計算・出典の整備状況"}</h2></div><p>{en ? `Confidence: ${summary.highConfidence} high, ${summary.mediumConfidence} medium, ${summary.lowConfidence} low. Low confidence does not mean a city is bad; it means the current evidence cannot support precise financial ranking.` : `信頼度は高${summary.highConfidence}都市・中${summary.mediumConfidence}都市・低${summary.lowConfidence}都市です。低信頼度は都市の評価ではなく、現時点の根拠では精密な金額順位を出せないという意味です。`}</p></div>
      <div className="reference-table-wrap"><table className="reference-table"><thead><tr><th>{en ? "City" : "都市"}</th><th>{en ? "Financial calculation" : "金額計算"}</th><th>{en ? "Confidence" : "信頼度"}</th><th>{en ? "Living-cost scope" : "生活費の範囲"}</th><th>{en ? "Catalog review" : "カタログ確認"}</th></tr></thead><tbody>{rows.map((row) => {
        const city = cities[row.cityId];
        const label = localizedCity(city, en ? "en" : "ja");
        return <tr key={row.cityId}><td><Link href={`/cities/${citySlug(row.cityId)}${en ? "?lang=en" : ""}`}><strong>{label.name}</strong><small>{label.country}</small></Link></td><td><span className={`reference-badge is-${row.calculationStatus}`}>{status(row.calculationStatus)}</span></td><td><strong>{confidence(row.confidenceLevel)} · {row.confidenceScore}/100</strong></td><td>{row.containsSavedEstimate ? (en ? "Includes a saved estimate" : "保存推定値を含む") : (en ? "Sourced benchmark" : "出典付き基準値")}</td><td><strong>{localizedUpdatedAt(row.updatedAt, en ? "en" : "ja")}</strong><small>{freshness(row.freshness.status)}</small></td></tr>;
      })}</tbody></table></div>
    </section>
    <div className="growth-cta"><div><strong>{en ? "Use confidence with the calculation" : "計算と信頼度を一緒に見る"}</strong><p>{en ? "Offer Analyzer keeps unsupported financial results from receiving an inflated rank." : "Offer Analyzerは金額計算できない候補が不当に高順位にならないようにします。"}</p></div><div className="reference-actions"><Link className="secondary-button" href={`/methodology${en ? "?lang=en" : ""}`}>{en ? "Read methodology" : "計算方法を読む"}</Link><Link className="primary-button" href="/analyze">Offer Analyzer</Link></div></div>
  </main>;
}
