import type { Metadata } from "next";
import Link from "next/link";

import { CALCULATION_VERSION } from "../../lib/calculations/calculate-scenario";
import { LIFE_ATLAS_SCORE_WEIGHTS } from "../../lib/scoring/life-atlas-score";

export const metadata: Metadata = {
  title: "Calculation methodology | Life Atlas",
  description: "LifeAtlasの手取り、生活費、貯蓄、FIRE、スコア、データ信頼度の計算方法を説明します。",
};

export default async function MethodologyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const en = lang === "en";
  const copy = en ? {
    eyebrow: "CALCULATION METHODOLOGY",
    title: "The numbers decide first. AI explains second.",
    intro: "LifeAtlas reruns one deterministic engine whenever an input changes. The same calculation contract powers comparison, Offer Analyzer, saved results and AI context.",
    sections: [
      ["1. Gross to net", "Salary and bonus are converted into the destination currency, then the supported tax and payroll-insurance model is applied. If a tax system is unsupported, take-home and savings remain unavailable rather than being guessed."],
      ["2. Monthly living cost", "Rent uses the selected housing type or an explicit custom value. Other spending uses the household, children and lifestyle assumptions or a custom monthly amount."],
      ["3. Savings and purchasing power", "Monthly surplus = monthly take-home − rent − other monthly spending. Annual savings is twelve times that surplus. Purchasing power compares take-home with the same scenario's total living cost."],
      ["4. Long-term and FIRE", "Five- and ten-year wealth projections use the stated starting balance and return assumption. The simple FIRE target is 25× annual living cost; it is a planning reference, not investment advice."],
    ],
    scoreTitle: "LifeAtlas Score",
    scoreNote: "Scores rank only the scenarios currently being compared. Unsupported financial scenarios cannot outrank supported ones and their result is capped and reduced.",
    confidenceTitle: "Data confidence",
    confidenceText: "Confidence is weighted 45% tax model, 35% living-cost evidence and 20% exchange-rate status. Government rules score higher than saved estimates; fallback FX is marked lower confidence.",
    toolsTitle: "What-If, break-even and AI",
    toolsText: "What-If reruns the same engine after explicit changes. Break-even searches for the salary at which the chosen metric matches the winner. AI receives structured results only and cannot alter calculations or invent missing tax data.",
    warning: "Results are estimates and do not fully reflect individual deductions, immigration status, benefits, private insurance or professional advice. Check current official sources before acting.",
    data: "See all 50 cities and data coverage",
    analyze: "Open Offer Analyzer",
  } : {
    eyebrow: "計算方法",
    title: "数字が先に決め、AIは後から説明します。",
    intro: "LifeAtlasは入力が変わるたびに、同じ決定論的な計算エンジンを再実行します。通常比較、Offer Analyzer、保存結果、AIへの構造化入力は同じ計算契約を使います。",
    sections: [
      ["1. 総支給から手取り", "給与と賞与を目的地通貨へ換算し、対応済みの税金・社会保険モデルを適用します。税制度が未対応なら、推測せず手取りと貯蓄を未計算にします。"],
      ["2. 毎月の生活費", "家賃は住居タイプまたは明示入力を使います。その他支出は世帯・子ども・生活スタイルの条件、または入力した月額を使います。"],
      ["3. 貯蓄と購買力", "月間余剰＝月間手取り−家賃−その他月間支出。年間貯蓄はその12か月分です。購買力は同じ条件の手取りと総生活費の比率から求めます。"],
      ["4. 長期資産とFIRE", "5年・10年後の資産は開始資産と明示した運用利回りで試算します。FIRE目標は年間生活費の25倍という簡易目安で、投資助言ではありません。"],
    ],
    scoreTitle: "LifeAtlas Score",
    scoreNote: "スコアは今比較している候補内の順位です。金額計算できない候補は対応済み候補より上位にならず、スコアも上限設定と減点を行います。",
    confidenceTitle: "データ信頼度",
    confidenceText: "信頼度は税モデル45%、生活費の根拠35%、為替状態20%です。政府制度は保存推定値より高く、代替為替は低い信頼度として明示します。",
    toolsTitle: "What-If・逆転給与・AI",
    toolsText: "What-Ifは変更条件で同じエンジンを再実行します。逆転給与は指定指標が首位に並ぶ給与を探索します。AIは構造化済み結果だけを受け取り、計算の変更や未整備税制の創作はできません。",
    warning: "結果は概算です。個別控除、在留資格、福利厚生、任意保険などを完全には反映せず、専門助言ではありません。行動前に最新の公式資料を確認してください。",
    data: "50都市のデータ範囲を見る",
    analyze: "Offer Analyzerを開く",
  };

  const weights = [
    [en ? "Financial" : "財務", LIFE_ATLAS_SCORE_WEIGHTS.financial],
    [en ? "Lifestyle" : "暮らし" , LIFE_ATLAS_SCORE_WEIGHTS.lifestyle],
    [en ? "Personal priorities" : "個人の優先軸", LIFE_ATLAS_SCORE_WEIGHTS.preference],
    [en ? "Data confidence" : "データ信頼度", LIFE_ATLAS_SCORE_WEIGHTS.confidence],
  ] as const;

  return <main className="growth-page reference-page">
    <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Analyzer</Link><Link href={`/data${en ? "?lang=en" : ""}`}>Data</Link><Link href={en ? "/methodology" : "/methodology?lang=en"}>{en ? "日本語" : "English"}</Link></nav></header>
    <section className="growth-hero reference-hero"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className="growth-facts"><span>{CALCULATION_VERSION}</span><span>50 {en ? "cities" : "都市"}</span><span>2–5 {en ? "scenarios" : "候補"}</span></div></section>
    <section className="growth-section reference-section"><div className="reference-step-grid">{copy.sections.map(([title, body]) => <article className="growth-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="growth-section reference-section"><div className="growth-section-heading"><div><p className="eyebrow">45 / 20 / 25 / 10</p><h2>{copy.scoreTitle}</h2></div><p>{copy.scoreNote}</p></div><div className="reference-weight-grid">{weights.map(([label, weight]) => <div key={label}><span>{label}</span><strong>{weight * 100}%</strong><i style={{ width: `${weight * 100}%` }} /></div>)}</div></section>
    <section className="growth-section reference-two-column"><article className="growth-panel"><p className="eyebrow">CONFIDENCE</p><h2>{copy.confidenceTitle}</h2><p>{copy.confidenceText}</p></article><article className="growth-panel"><p className="eyebrow">DETERMINISTIC TOOLS</p><h2>{copy.toolsTitle}</h2><p>{copy.toolsText}</p></article></section>
    <aside className="growth-note reference-warning"><strong>{en ? "Important limits" : "重要な限界"}</strong><p>{copy.warning}</p></aside>
    <div className="growth-cta"><div><strong>{copy.data}</strong><p>{en ? "Source periods, saved estimates and unsupported calculations are shown city by city." : "参照期間、保存推定値、未対応計算を都市ごとに表示します。"}</p></div><div className="reference-actions"><Link className="secondary-button" href={`/data${en ? "?lang=en" : ""}`}>{copy.data}</Link><Link className="primary-button" href="/analyze">{copy.analyze}</Link></div></div>
  </main>;
}
