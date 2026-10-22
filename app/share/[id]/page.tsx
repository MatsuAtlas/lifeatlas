import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cities, cityOrder } from "../../../data/cities";
import { PageViewTracker } from "../../../components/analytics/page-view-tracker";
import { localizedCity, localizedDataScope } from "../../../lib/cities/localization";
import { formatCurrency, formatPercent } from "../../../lib/formatters";
import { readPublicShare } from "../../../lib/share/server";
import { isSupabaseNotConfiguredError } from "../../../lib/supabase-server";

const CITY_COUNT = cityOrder.length;

// 移住者向けの税の特例を実装した税制度ごとの名前（共有ページの注記用）。
const expatRegimeNames: Partial<Record<string, { ja: string; en: string }>> = {
  netherlands: { ja: "オランダの30%ルール", en: "the Dutch 30% ruling" },
  korea: { ja: "韓国の外国人勤労者の単一税率19%", en: "Korea's 19% flat rate for foreign workers" },
  spain: { ja: "スペインの移住者向け特別制度", en: "Spain's special regime for incoming workers" },
  portugal: { ja: "ポルトガルのIFICI（20%）", en: "Portugal's IFICI (20%)" },
};

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
  const winner = record.snapshot.winnerCityId ? localizedCity(cities[record.snapshot.winnerCityId], language) : null;

  return (
    <main className="growth-page" lang={language}>
      <PageViewTracker event="share_viewed" eventKey={`share:${id}`} />
      <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Offer Analyzer</Link><Link href="/pricing">Pro</Link></nav></header>
      <section className="growth-hero">
        <p className="eyebrow">PUBLIC DECISION SNAPSHOT</p>
        <h1>{record.title}</h1>
        <p>{record.snapshot.explanation}</p>
        <div className="growth-winner"><span>{isJa ? "最適候補" : "Best fit"}</span><strong>{winner ? winner.name : (isJa ? "なし（計算できる候補がありません）" : "None (no option can be calculated)")}</strong></div>
      </section>
      <section className="growth-section">
        <div className="growth-section-heading"><div><p className="eyebrow">RANKING</p><h2>{isJa ? "比較結果" : "Comparison result"}</h2></div><p>{isJa ? "氏名、メール、年齢、配偶者の給与額、カスタム支出は公開していません。都市・年収・本人の年間手取りと計算結果を公開しています。夫婦の比較では世帯（本人＋配偶者）の年間手取りも公開しており、そこから配偶者の収入を推測できる場合があります。" : "Names, email, age, your spouse's salary and custom spending are not included. Cities, gross income, your annual take-home and the results are shown; for couples, household (you plus your spouse) annual take-home is also shown, from which your spouse's income may be inferred."}</p></div>
        <div className="growth-card-grid">{record.snapshot.scenarios.map((scenario) => {
          const city = cities[scenario.cityId];
          const label = localizedCity(city, language);
          // 計算できない候補（ranked: false）には順位を表示しません。
          const ranked = scenario.ranked !== false;
          return <article className={ranked && scenario.rank === 1 ? "growth-card is-winner" : "growth-card"} key={scenario.cityId}>
            <div className="growth-card-title"><span>{ranked ? `#${scenario.rank}` : (isJa ? "順位なし" : "Not ranked")}</span><div><small>{label.country}</small><h3>{label.name}</h3></div><strong>{scenario.score}<small>/100</small></strong></div>
            <dl className="growth-metrics">
              <div><dt>{isJa ? "年収" : "Gross income"}</dt><dd>{formatCurrency(scenario.grossAnnual, scenario.currency, language)}</dd></div>
              <div><dt>{scenario.cashflowBasis === "household" ? (isJa ? "本人の年間手取り" : "Your annual take-home") : (isJa ? "年間手取り" : "Annual take-home")}</dt><dd>{formatCurrency(scenario.netAnnual, scenario.currency, language)}</dd></div>
              {scenario.cashflowBasis === "household" && <div><dt>{isJa ? "世帯の年間手取り" : "Household annual take-home"}</dt><dd>{formatCurrency(scenario.householdNetAnnual ?? null, scenario.currency, language)}</dd></div>}
              <div><dt>{isJa ? "月間生活費" : "Monthly living cost"}</dt><dd>{formatCurrency(scenario.totalLivingCostMonthly, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "年間貯蓄" : "Annual savings"}</dt><dd>{formatCurrency(scenario.annualSavings, scenario.currency, language)}</dd></div>
              <div><dt>{isJa ? "貯蓄率" : "Savings rate"}</dt><dd>{formatPercent(scenario.savingsRate)}</dd></div>
              <div><dt>{isJa ? "データ信頼度" : "Data confidence"}</dt><dd>{scenario.dataConfidence.score}/100</dd></div>
            </dl>
            {scenario.expatTaxRegime === "applied" && expatRegimeNames[city.taxSystem] ? <p className="growth-scope">{isJa ? `移住者向けの税の特例（${expatRegimeNames[city.taxSystem]!.ja}）を適用した計算です。` : `Calculated with a newcomer tax regime (${expatRegimeNames[city.taxSystem]!.en}).`}</p> : null}
            <p className="growth-scope">{isJa ? "データ範囲" : "Data scope"}: {localizedDataScope(city, language)}</p>
          </article>;
        })}</div>
      </section>
      <aside className="growth-note"><strong>{isJa ? "共有データについて" : "About this shared result"}</strong><p>{isJa ? "このページは作成者が明示的に公開した比較スナップショットです。公開情報と保存参考値による概算であり、税務・金融・移住助言ではありません。" : "This is an explicitly published comparison snapshot. It uses public sources and saved reference values and is not tax, financial or immigration advice."}</p><small>{record.snapshot.calculationVersion} · {new Date(record.snapshot.calculatedAt).toLocaleDateString(isJa ? "ja-JP" : "en-US")}</small></aside>
      <div className="growth-cta"><div><strong>{isJa ? "自分の条件で比較する" : "Compare your own options"}</strong><p>{isJa ? `LifeAtlasは${CITY_COUNT}都市を同じ計算エンジンで比較します。` : `LifeAtlas compares ${CITY_COUNT} cities with one deterministic engine.`}</p></div><Link className="primary-button" href="/analyze">Offer Analyzer →</Link></div>
    </main>
  );
}
