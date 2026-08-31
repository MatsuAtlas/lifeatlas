import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cities, cityOrder } from "../../../data/cities";
import { localizedCity, localizedDataScope, localizedPopulation, localizedSourceItem, localizedUpdatedAt, type SupportedLanguage } from "../../../lib/cities/localization";
import { formatCurrency, formatPercent } from "../../../lib/formatters";
import { calculateCityBaseline } from "../../../lib/seo/calculations";
import { cityIdFromSlug, citySlug, comparisonSlug, SEO_COMPARE_PAIRS } from "../../../lib/seo/city-slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return cityOrder.map((city) => ({ city: citySlug(city) }));
}

function languageFrom(value: string | string[] | undefined): SupportedLanguage {
  return value === "en" ? "en" : "ja";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ city: string }>; searchParams: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const { city: slug } = await params;
  const cityId = cityIdFromSlug(slug);
  if (!cityId) return { title: "City not found | Life Atlas", robots: { index: false, follow: false } };
  const language = languageFrom((await searchParams).lang);
  const label = localizedCity(cities[cityId], language);
  const title = language === "ja" ? `${label.name}の給与・生活費シミュレーター | Life Atlas` : `${label.name} salary and living-cost calculator | Life Atlas`;
  const description = language === "ja"
    ? `${label.name}の給与中央値、手取り、家賃、生活費、貯蓄率とデータ信頼度をLifeAtlasの決定的計算で確認します。`
    : `Explore ${label.name} income, take-home pay, rent, living costs, savings and data confidence with deterministic LifeAtlas calculations.`;
  return { title, description, alternates: { canonical: `/cities/${slug}` }, openGraph: { title, description, type: "article" } };
}

export default async function CitySeoPage({ params, searchParams }: { params: Promise<{ city: string }>; searchParams: Promise<{ lang?: string | string[] }> }) {
  const { city: slug } = await params;
  const cityId = cityIdFromSlug(slug);
  if (!cityId) notFound();
  const language = languageFrom((await searchParams).lang);
  const isJa = language === "ja";
  const city = cities[cityId];
  const label = localizedCity(city, language);
  const result = calculateCityBaseline(cityId);
  const related = SEO_COMPARE_PAIRS.filter(([cityA, cityB]) => cityA === cityId || cityB === cityId);

  return (
    <main className="growth-page" lang={language}>
      <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Offer Analyzer</Link><Link href={`/cities/${slug}?lang=${isJa ? "en" : "ja"}`}>{isJa ? "English" : "日本語"}</Link></nav></header>
      <section className="growth-hero">
        <p className="eyebrow">CITY DECISION GUIDE · {label.country}</p>
        <h1>{isJa ? `${label.name}で暮らす数字を、先に見る。` : `See the numbers behind living in ${label.name}.`}</h1>
        <p>{isJa ? `${label.name}の地域給与目安を使い、単身・30歳・1ベッドルーム・標準生活の条件で計算しています。` : `Calculated with ${label.name}'s local income benchmark for a single 30-year-old in a one-bedroom home with a balanced lifestyle.`}</p>
        <div className="growth-facts"><span>{label.region}</span><span>{city.currency}</span><span>{label.climate}</span><span>{label.language}</span></div>
      </section>
      <section className="growth-section">
        <div className="growth-section-heading"><div><p className="eyebrow">BASELINE CALCULATION</p><h2>{isJa ? "給与と生活費の基準シナリオ" : "Income and cost baseline"}</h2></div><p>{isJa ? "税・保険未対応の都市では手取りや貯蓄を推測せず、—で表示します。" : "If taxes are unsupported, take-home pay and savings remain unavailable rather than being invented."}</p></div>
        <dl className="growth-metric-grid">
          <div><dt>{isJa ? "地域給与目安" : "Local income benchmark"}</dt><dd>{formatCurrency(result.grossAnnual, result.currency, language)}</dd></div>
          <div><dt>{isJa ? "年間手取り" : "Annual take-home"}</dt><dd>{formatCurrency(result.netAnnual, result.currency, language)}</dd></div>
          <div><dt>{isJa ? "月額家賃" : "Monthly rent"}</dt><dd>{formatCurrency(result.rentMonthly, result.currency, language)}</dd></div>
          <div><dt>{isJa ? "月間生活費" : "Monthly living cost"}</dt><dd>{formatCurrency(result.totalLivingCostMonthly, result.currency, language)}</dd></div>
          <div><dt>{isJa ? "年間貯蓄" : "Annual savings"}</dt><dd>{formatCurrency(result.annualSavings, result.currency, language)}</dd></div>
          <div><dt>{isJa ? "貯蓄率" : "Savings rate"}</dt><dd>{formatPercent(result.savingsRate)}</dd></div>
          <div><dt>{isJa ? "家賃負担率" : "Rent burden"}</dt><dd>{formatPercent(result.rentBurden)}</dd></div>
          <div><dt>{isJa ? "データ信頼度" : "Data confidence"}</dt><dd>{result.dataConfidence.score}/100 · {result.dataConfidence.level}</dd></div>
        </dl>
      </section>
      <section className="growth-section growth-two-column">
        <article className="growth-panel"><p className="eyebrow">CITY PROFILE</p><h2>{isJa ? "暮らしの基礎情報" : "City fundamentals"}</h2><dl className="growth-detail-list"><div><dt>{isJa ? "人口" : "Population"}</dt><dd>{localizedPopulation(city, language)}</dd></div><div><dt>{isJa ? "タイムゾーン" : "Timezone"}</dt><dd>{city.timezone}</dd></div><div><dt>{isJa ? "暮らしやすさ" : "Livability"}</dt><dd>{city.scores.livability}/100</dd></div><div><dt>{isJa ? "安全性" : "Safety"}</dt><dd>{city.scores.safety}/100</dd></div><div><dt>{isJa ? "ビジネス参考スコア" : "Business reference score"}</dt><dd>{city.scores.business}/100</dd></div></dl></article>
        <article className="growth-panel"><p className="eyebrow">DATA SCOPE</p><h2>{isJa ? "出典と更新範囲" : "Sources and coverage"}</h2><p className="growth-scope">{localizedDataScope(city, language)}</p><p className="growth-updated">{isJa ? "都市データ更新" : "City data updated"}: {localizedUpdatedAt(city.updatedAt, language)}</p><ul className="growth-source-list">{city.dataSources.map((source) => <li key={`${source.item}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer">{localizedSourceItem(source.item, language)} · {source.source}</a><small>{source.level} · {source.period}</small></li>)}</ul></article>
      </section>
      {related.length > 0 && <section className="growth-section"><div className="growth-section-heading"><div><p className="eyebrow">COMPARE</p><h2>{isJa ? `${label.name}を他都市と比較` : `Compare ${label.name}`}</h2></div></div><div className="growth-link-grid">{related.map(([cityA, cityB]) => { const a = localizedCity(cities[cityA], language).name; const b = localizedCity(cities[cityB], language).name; return <Link href={`/compare/${comparisonSlug(cityA, cityB)}${isJa ? "" : "?lang=en"}`} key={`${cityA}-${cityB}`}>{a} vs {b}<span>→</span></Link>; })}</div></section>}
      <div className="growth-cta"><div><strong>{isJa ? "あなたの給与・世帯条件で再計算" : "Recalculate with your own offer"}</strong><p>{isJa ? "Offer Analyzerで最大5案を比較できます。" : "Compare up to five options in Offer Analyzer."}</p></div><Link className="primary-button" href="/analyze">Offer Analyzer →</Link></div>
    </main>
  );
}
