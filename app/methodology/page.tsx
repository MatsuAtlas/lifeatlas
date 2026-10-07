import type { Metadata } from "next";
import Link from "next/link";

import { cityOrder } from "../../data/cities";
import { CALCULATION_VERSION } from "../../lib/calculations/calculate-scenario";
import { LIFE_ATLAS_SCORE_WEIGHTS } from "../../lib/scoring/life-atlas-score";

const CITY_COUNT = cityOrder.length;

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
      ["5. Newcomer tax regimes", "Where a city has a modelled regime for people moving from abroad (the Dutch 30% ruling, Korea's 19% flat rate, Spain's special regime, Portugal's IFICI), it applies only if you choose it, and only when it lowers tax. Eligibility itself is your declaration; where official sources do not settle a case, regular tax is shown."],
      ["6. Work visa salary check", "For the UK, Germany, France, Spain, the Netherlands, Ireland, Australia, Singapore, Malaysia and Korea, base pay without bonus is compared with one main work visa's official salary threshold. It is shown as a note and a watch-out flag and does not change the score; employer sponsorship, occupation, qualifications and other conditions are not checked."],
      ["7. Family deductions (Japan, Korea, Hong Kong, UK and Ireland)", "For Japanese cities, an optional spouse salary and children's ages apply the 2026 spouse, special spouse and dependant deductions to income and resident tax; single parents get the single-parent deduction. Children are assumed to have no income. In Seoul, the same inputs apply Korea's 2026 basic deductions for a spouse earning up to KRW 5 million and children up to 20, the single-parent deduction and the child tax credit (ages 9+ for 2026 under the April 2026 amendment, excluding children born in 2017). In Hong Kong, a spouse salary of 0 applies the 2026/27 married person's allowance (HK$290,000) instead of the basic allowance. In the UK, Marriage Allowance (up to £252) applies when the spouse earns below £12,570 and you pay the basic rate (in Scotland, up to the intermediate rate). In Ireland, a spouse salary of 0 applies one-income married assessment (€53,000 standard rate band, €4,000 married credit), and a single parent with a child aged 18 or under gets the €1,900 single person child carer credit and a €48,000 band. Other countries do not use these inputs yet. Japan's child allowance (Children and Families Agency amounts from October 2024) is shown for reference at the 31 December ages and is not added to take-home or the score, because other countries' benefits are not modelled yet."],
    ],
    scoreTitle: "LifeAtlas Score",
    scoreNote: "Scores rank only the scenarios currently being compared. Unsupported financial scenarios cannot outrank supported ones and their result is capped and reduced.",
    confidenceTitle: "Data confidence",
    confidenceText: "Confidence is weighted 45% tax model, 35% living-cost evidence and 20% exchange-rate status. Government rules score higher than saved estimates; fallback FX is marked lower confidence.",
    toolsTitle: "What-If, break-even and AI",
    toolsText: "What-If reruns the same engine after explicit changes. Break-even searches for the salary at which the chosen metric matches the winner. AI receives structured results only and cannot alter calculations or invent missing tax data.",
    warning: "Results are estimates and do not fully reflect individual deductions, immigration status, benefits, private insurance or professional advice. Check current official sources before acting.",
    data: `See all ${CITY_COUNT} cities and data coverage`,
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
      ["5. 移住者向けの税の特例", "移住者向けの特例を実装した都市（オランダの30%ルール、韓国の単一税率19%、スペインの特別制度、ポルトガルのIFICI）では、本人が選んだ場合だけ、通常より税が少ないときに使います。条件を満たすかは本人の申告で、公式資料で決まらない場合は通常の税で示します。"],
      ["6. 就労ビザの給与基準", "英国・ドイツ・フランス・スペイン・オランダ・アイルランド・豪州・シンガポール・マレーシア・韓国では、賞与を除く基本給を主な就労ビザ1つの公式の給与基準と比べます。注記と注意点として示し、スコアは変えません。雇用主のスポンサー登録・職種・学歴などの条件は判定しません。"],
      ["7. 家族の控除（日本・韓国・香港・英国・アイルランド）", "日本の都市では、任意で入力した配偶者の給与年収と子どもの年齢から、令和8年分の配偶者控除・配偶者特別控除・扶養控除を所得税と住民税に反映します。単身で子どもがいる場合はひとり親控除を使います。子どもに所得がない前提です。ソウルでは同じ入力から、2026年分の韓国の基本控除（給与500万ウォン以下の配偶者、20歳以下の子）、一人親の追加控除、子女税額控除（2026年4月の改正法の経過措置で2026年分は9歳以上、2017年生まれを除く）を反映します。香港では配偶者の給与を0と入れた場合、基礎控除の代わりに2026/27年度の既婚者控除（29万香港ドル）を使います。英国では配偶者の給与が£12,570未満で本人が基本税率（スコットランドは intermediate rate まで）の納税者なら Marriage Allowance（最大£252）を、アイルランドでは配偶者の給与が0なら片働き夫婦の合算課税（標準税率帯€53,000、既婚者控除€4,000）を、18歳以下の子がいる一人親には単親控除€1,900と標準税率帯€48,000を使います。他の国ではまだ使いません。児童手当（こども家庭庁、2024年10月以降の額）は12月31日時点の年齢での月額を参考に示し、他の国の手当が未対応のため手取り・スコアには含めません。"],
    ],
    scoreTitle: "LifeAtlas Score",
    scoreNote: "スコアは今比較している候補内の順位です。金額計算できない候補は対応済み候補より上位にならず、スコアも上限設定と減点を行います。",
    confidenceTitle: "データ信頼度",
    confidenceText: "信頼度は税モデル45%、生活費の根拠35%、為替状態20%です。政府制度は保存推定値より高く、代替為替は低い信頼度として明示します。",
    toolsTitle: "What-If・逆転給与・AI",
    toolsText: "What-Ifは変更条件で同じエンジンを再実行します。逆転給与は指定指標が首位に並ぶ給与を探索します。AIは構造化済み結果だけを受け取り、計算の変更や未整備税制の創作はできません。",
    warning: "結果は概算です。個別控除、在留資格、福利厚生、任意保険などを完全には反映せず、専門助言ではありません。行動前に最新の公式資料を確認してください。",
    data: `${CITY_COUNT}都市のデータ範囲を見る`,
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
    <section className="growth-hero reference-hero"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className="growth-facts"><span>{CALCULATION_VERSION}</span><span>{CITY_COUNT} {en ? "cities" : "都市"}</span><span>2–5 {en ? "scenarios" : "候補"}</span></div></section>
    <section className="growth-section reference-section"><div className="reference-step-grid">{copy.sections.map(([title, body]) => <article className="growth-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="growth-section reference-section"><div className="growth-section-heading"><div><p className="eyebrow">45 / 20 / 25 / 10</p><h2>{copy.scoreTitle}</h2></div><p>{copy.scoreNote}</p></div><div className="reference-weight-grid">{weights.map(([label, weight]) => <div key={label}><span>{label}</span><strong>{weight * 100}%</strong><i style={{ width: `${weight * 100}%` }} /></div>)}</div></section>
    <section className="growth-section reference-two-column"><article className="growth-panel"><p className="eyebrow">CONFIDENCE</p><h2>{copy.confidenceTitle}</h2><p>{copy.confidenceText}</p></article><article className="growth-panel"><p className="eyebrow">DETERMINISTIC TOOLS</p><h2>{copy.toolsTitle}</h2><p>{copy.toolsText}</p></article></section>
    <aside className="growth-note reference-warning"><strong>{en ? "Important limits" : "重要な限界"}</strong><p>{copy.warning}</p></aside>
    <div className="growth-cta"><div><strong>{copy.data}</strong><p>{en ? "Source periods, saved estimates and unsupported calculations are shown city by city." : "参照期間、保存推定値、未対応計算を都市ごとに表示します。"}</p></div><div className="reference-actions"><Link className="secondary-button" href={`/data${en ? "?lang=en" : ""}`}>{copy.data}</Link><Link className="primary-button" href="/analyze">{copy.analyze}</Link></div></div>
  </main>;
}
