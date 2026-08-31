import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cities } from "../../../data/cities";
import { PageViewTracker } from "../../../components/analytics/page-view-tracker";
import { localizedCity, localizedDataScope } from "../../../lib/cities/localization";
import { formatCurrency, formatPercent } from "../../../lib/formatters";
import { readPublicShare } from "../../../lib/share/server";
import { isSupabaseNotConfiguredError } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

async function loadShare(id: string) {
  try {
    return await readPublicShare(id);
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const record = await loadShare(id);
  if (!record) return { title: "Shared analysis not found | Life Atlas", robots: { index: false, follow: false } };
  const description = record.snapshot.explanation;
  return {
    title: `${record.title} | Life Atlas`,
    description,
    openGraph: { title: record.title, description, type: "article" },
    twitter: { card: "summary_large_image", title: record.title, description },
  };
}

export default async function PublicSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await loadShare(id);
  if (!record) notFound();
  const language = record.language;
  const isJa = language === "ja";
  const winner = localizedCity(cities[record.snapshot.winnerCityId], language);

  return (
    <main className="growth-page" lang={language}>
      <PageViewTracker event="share_viewed" eventKey={`share:${id}`} />
      <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Offer Analyzer</Link><Link href="/pricing">Pro</Link></nav></header>
      <section className="growth-hero">
        <p className="eyebrow">PUBLIC DECISION SNAPSHOT</p>
        <h1>{record.title}</h1>
        <p>{record.snapshot.explanation}</p>
        <div className="growth-winner"><span>{isJa ? "最適候補" : "Best fit"}</span><strong>{winner.name}</strong></div>
      </section>
      <section className="growth-section">
        <div className="growth-section-heading"><div><p className="eyebrow">RANKING</p><h2>{isJa ? "比較結果" : "Comparison result"}</h2></div><p>{isJa ? "氏名、メール、年齢、世帯、カスタム支出は公開していません。" : "Names, email, age, household and custom spending are not included."}</p></div>
        <div className="growth-card-grid">{record.snapshot.scenarios.map((scenario) => {
          const city = cities[scenario.cityId];
          const label = localizedCity(city, language);
          return <article className={scenario.rank === 1 ? "growth-card is-winner" : "growth-card"} key={scenario.cityId}>
            <div className="growth-card-title"><span>#{scenario.rank}</span><div><small>{label.country}</small><h3>{label.name}</h3></div><strong>{scenario.score}<small>/100</small></strong></div>
            <dl className="growth-metrics">
              <div><dt>{isJa ? "年収" : "Gross income"}</dt><dd>{formatCurrency(scenario.grossAnnual, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "年間手取り" : "Annual take-home"}</dt><dd>{formatCurrency(scenario.netAnnual, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "月間生活費" : "Monthly living cost"}</dt><dd>{formatCurrency(scenario.totalLivingCostMonthly, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "年間貯蓄" : "Annual savings"}</dt><dd>{formatCurrency(scenario.annualSavings, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "貯蓄率" : "Savings rate"}</dt><dd>{formatPercent(scenario.savingsRate)}</dd></div>
              <div><dt>{isJa ? "データ信頼度" : "Data confidence"}</dt><dd>{scenario.dataConfidence.score}/100</dd></div>
            </dl>
            <p className="growth-scope">{isJa ? "データ範囲" : "Data scope"}: {localizedDataScope(city, language)}</p>
          </article>;
        })}</div>
      </section>
      <aside className="growth-note"><strong>{isJa ? "共有データについて" : "About this shared result"}</strong><p>{isJa ? "このページは作成者が明示的に公開した比較スナップショットです。公開情報と保存参考値による概算であり、税務・金融・移住助言ではありません。" : "This is an explicitly published comparison snapshot. It uses public sources and saved reference values and is not tax, financial or immigration advice."}</p><small>{record.snapshot.calculationVersion} · {new Date(record.snapshot.calculatedAt).toLocaleDateString(isJa ? "ja-JP" : "en-US")}</small></aside>
      <div className="growth-cta"><div><strong>{isJa ? "自分の条件で比較する" : "Compare your own options"}</strong><p>{isJa ? "LifeAtlasは50都市を同じ計算エンジンで比較します。" : "LifeAtlas compares 50 cities with one deterministic engine."}</p></div><Link className="primary-button" href="/analyze">Offer Analyzer →</Link></div>
    </main>
  );
}
