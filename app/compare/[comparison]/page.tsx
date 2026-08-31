import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cities } from "../../../data/cities";
import { localizedCity, localizedDataScope, type SupportedLanguage } from "../../../lib/cities/localization";
import { formatCurrency, formatPercent } from "../../../lib/formatters";
import { calculateSeoComparison } from "../../../lib/seo/calculations";
import { citySlug, comparisonFromSlug, comparisonSlug, SEO_COMPARE_PAIRS } from "../../../lib/seo/city-slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_COMPARE_PAIRS.map(([cityA, cityB]) => ({ comparison: comparisonSlug(cityA, cityB) }));
}

function languageFrom(value: string | string[] | undefined): SupportedLanguage {
  return value === "en" ? "en" : "ja";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ comparison: string }>; searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const { comparison } = await params;
  const pair = comparisonFromSlug(comparison);
  if (!pair) return { title: "Comparison not found | Life Atlas", robots: { index: false, follow: false } };
  const language = languageFrom((await searchParams).lang);
  const a = localizedCity(cities[pair.cityA], language).name;
  const b = localizedCity(cities[pair.cityB], language).name;
  const title = language === "ja" ? `${a} vs ${b}：給与・生活費比較 | Life Atlas` : `${a} vs ${b}: income and living-cost comparison | Life Atlas`;
  const description = language === "ja" ? `${a}と${b}を手取り、生活費、年間貯蓄、LifeAtlas Score、データ信頼度で比較します。` : `Compare ${a} and ${b} by take-home pay, living costs, annual savings, LifeAtlas Score and data confidence.`;
  return { title, description, alternates: { canonical: `/compare/${comparison}` }, openGraph: { title, description, type: "article" } };
}

export default async function SeoComparisonPage({ params, searchParams }: { params: Promise<{ comparison: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const { comparison } = await params;
  const pair = comparisonFromSlug(comparison);
  if (!pair) notFound();
  const language = languageFrom((await searchParams).lang);
  const isJa = language === "ja";
  const calculation = calculateSeoComparison(pair.cityA, pair.cityB);
  const resultById = new Map(calculation.results.map((result) => [result.scenarioId, result]));
  const winnerScore = calculation.scores[0];
  const winner = resultById.get(winnerScore.scenarioId);
  if (!winner) notFound();
  const winnerLabel = localizedCity(cities[winner.cityId], language);
  const labels = [localizedCity(cities[pair.cityA], language), localizedCity(cities[pair.cityB], language)];

  return (
    <main className="growth-page" lang={language}>
      <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Offer Analyzer</Link><Link href={`/compare/${comparison}?lang=${isJa ? "en" : "ja"}`}>{isJa ? "English" : "日本語"}</Link></nav></header>
      <section className="growth-hero"><p className="eyebrow">DETERMINISTIC CITY COMPARISON</p><h1>{labels[0].name} <em>vs</em> {labels[1].name}</h1><p>{isJa ? "各都市の地域給与目安を使い、単身・30歳・1ベッドルーム・標準生活で比較しています。" : "Uses each city's local income benchmark for a single 30-year-old in a one-bedroom home with a balanced lifestyle."}</p><div className="growth-winner"><span>{isJa ? "基準条件の最適候補" : "Best fit for this baseline"}</span><strong>{winnerLabel.name} · {winnerScore.score}/100</strong></div></section>
      <section className="growth-section"><div className="growth-section-heading"><div><p className="eyebrow">HEAD TO HEAD</p><h2>{isJa ? "数字を同じ条件で比較" : "The numbers on equal assumptions"}</h2></div><p>{isJa ? "税・保険未対応なら手取りと貯蓄は推測せず—で表示します。" : "Unsupported tax systems leave take-home pay and savings unavailable rather than estimated."}</p></div><div className="growth-card-grid">{calculation.scores.map((score) => { const result = resultById.get(score.scenarioId); if (!result) return null; const city = cities[result.cityId]; const label = localizedCity(city, language); return <article className={score.rank === 1 ? "growth-card is-winner" : "growth-card"} key={result.cityId}><div className="growth-card-title"><span>#{score.rank}</span><div><small>{label.country}</small><h3>{label.name}</h3></div><strong>{score.score}<small>/100</small></strong></div><dl className="growth-metrics"><div><dt>{isJa ? "地域給与目安" : "Income benchmark"}</dt><dd>{formatCurrency(result.grossAnnual, result.currency, language)}</dd></div><div><dt>{isJa ? "年間手取り" : "Annual take-home"}</dt><dd>{formatCurrency(result.netAnnual, result.currency, language)}</dd></div><div><dt>{isJa ? "月間生活費" : "Monthly living cost"}</dt><dd>{formatCurrency(result.totalLivingCostMonthly, result.currency, language)}</dd></div><div><dt>{isJa ? "年間貯蓄" : "Annual savings"}</dt><dd>{formatCurrency(result.annualSavings, result.currency, language)}</dd></div><div><dt>{isJa ? "貯蓄率" : "Savings rate"}</dt><dd>{formatPercent(result.savingsRate)}</dd></div><div><dt>{isJa ? "データ信頼度" : "Data confidence"}</dt><dd>{result.dataConfidence.score}/100</dd></div></dl><p className="growth-scope"><strong>{isJa ? "データ範囲" : "Data scope"}:</strong> {localizedDataScope(city, language)}</p><Link className="growth-city-link" href={`/cities/${citySlug(result.cityId)}${isJa ? "" : "?lang=en"}`}>{isJa ? `${label.name}の詳細` : `${label.name} details`} →</Link></article>; })}</div></section>
      <aside className="growth-note"><strong>{isJa ? "読み方" : "How to read this"}</strong><p>{isJa ? "LifeAtlas Scoreは財務45%、生活20%、優先軸25%、データ信頼度10%です。このSEO比較では標準優先軸を使い、AIに数値を生成させていません。" : "LifeAtlas Score combines 45% financial, 20% lifestyle, 25% priorities and 10% data confidence. This page uses default priorities and no AI-generated numbers."}</p></aside>
      <div className="growth-cta"><div><strong>{isJa ? "実際のオファーで比較する" : "Compare real offers"}</strong><p>{isJa ? "給与・世帯・住居・優先軸をあなたの条件に変更できます。" : "Use your own salary, household, housing and priorities."}</p></div><Link className="primary-button" href="/analyze">Offer Analyzer →</Link></div>
    </main>
  );
}
