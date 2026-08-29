"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { cities, cityOrder } from "../../data/cities";
import { DEFAULT_PRIORITIES } from "../../lib/scoring/life-atlas-score";
import { simulateWhatIf } from "../../lib/calculations/what-if";
import type { City, CityId, CurrencyCode } from "../../types/city";
import type { BreakEvenMetric } from "../../types/break-even";
import type { HousingType, LifestyleType } from "../../types/finance";
import type { PriorityKey, ScenarioHousehold, ScenarioInput, ScenarioResult, ScenarioScore, UserPriorities } from "../../types/scenario";
import type { WhatIfChange } from "../../types/what-if";

type Language = "ja" | "en";

const initialScenarios: ScenarioInput[] = [
  {
    id: "offer-tokyo",
    cityId: "tokyo",
    annualSalary: 7_000_000,
    salaryCurrency: "JPY",
    age: 29,
    householdType: "single",
    children: 0,
    housing: "onebed",
    lifestyle: "balanced",
    retirementAge: 65,
    annualReturnRate: 0,
  },
  {
    id: "offer-vancouver",
    cityId: "vancouver",
    annualSalary: 90_000,
    salaryCurrency: "CAD",
    age: 29,
    householdType: "single",
    children: 0,
    housing: "onebed",
    lifestyle: "balanced",
    retirementAge: 65,
    annualReturnRate: 0,
  },
];

const priorityOrder: PriorityKey[] = [
  "savings",
  "purchasingPower",
  "qualityOfLife",
  "career",
  "entrepreneurship",
  "fire",
  "family",
  "safety",
  "climate",
  "remoteWork",
];

const priorityLabels: Record<PriorityKey, { ja: string; en: string }> = {
  savings: { ja: "貯蓄", en: "Savings" },
  purchasingPower: { ja: "購買力", en: "Purchasing power" },
  qualityOfLife: { ja: "暮らしやすさ", en: "Quality of life" },
  entrepreneurship: { ja: "起業環境", en: "Entrepreneurship" },
  fire: { ja: "FIRE", en: "FIRE" },
  family: { ja: "家族との暮らし", en: "Family" },
  safety: { ja: "安全性", en: "Safety" },
  climate: { ja: "気候", en: "Climate" },
  career: { ja: "キャリア機会", en: "Career" },
  remoteWork: { ja: "リモートワーク", en: "Remote work" },
};

const factorLabels: Record<string, { ja: string; en: string }> = {
  "savings-rate": { ja: "貯蓄率", en: "Savings rate" },
  "annual-savings": { ja: "年間貯蓄", en: "Annual savings" },
  "disposable-income": { ja: "手取り収入", en: "Take-home income" },
  "purchasing-power": { ja: "購買力", en: "Purchasing power" },
  "housing-affordability": { ja: "住居負担", en: "Housing affordability" },
  "fire-trajectory": { ja: "FIRE到達性", en: "FIRE trajectory" },
  "quality-of-life": { ja: "暮らしやすさ", en: "Quality of life" },
  family: { ja: "家族適性", en: "Family fit" },
  safety: { ja: "安全性", en: "Safety" },
  "remote-work": { ja: "リモート適性", en: "Remote-work fit" },
  "data-confidence": { ja: "データ信頼度", en: "Data confidence" },
};

const riskLabels: Record<string, { ja: string; en: string }> = {
  "calculation-unavailable": { ja: "税・保険計算が未対応", en: "Tax calculation unavailable" },
  "negative-savings": { ja: "年間収支が赤字", en: "Negative annual savings" },
  "high-housing-burden": { ja: "住居費負担が高い", en: "High housing burden" },
  "low-data-confidence": { ja: "データ信頼度が低い", en: "Low data confidence" },
  "fire-target-unreachable": { ja: "現在条件ではFIRE未到達", en: "FIRE target not reached" },
};

const copy = {
  ja: {
    back: "都市比較へ戻る",
    language: "English",
    theme: "表示切替",
    eyebrow: "LifeAtlas Offer Analyzer",
    title: "どのオファーが、あなたの将来を強くするか。",
    intro: "2〜5件の仕事・移住案を、同じ計算エンジンで比較します。AIに数字を作らせず、税金・生活費・貯蓄・長期資産から順位を決めます。",
    live: "入力と同時に再計算",
    coverage: "世界50都市",
    scenarios: "比較するオファー",
    scenarioNote: "給与は各オファーの通貨で入力してください。税制度が未対応の都市は、推定手取りを表示しません。",
    add: "オファーを追加",
    remove: "削除",
    city: "都市",
    salary: "年間給与",
    bonus: "年間賞与",
    age: "年齢",
    household: "世帯",
    single: "単身",
    couple: "カップル・夫婦",
    children: "子ども",
    housing: "住居",
    lifestyle: "生活水準",
    customRent: "月額家賃（任意）",
    customSpending: "家賃以外の月額支出（任意）",
    savingsTarget: "貯蓄目標（任意）",
    priorities: "何を重視しますか？",
    prioritiesNote: "0は評価に使わず、5は最重要です。未整備の気候データなどはスコアに捏造せず、評価対象外として表示します。",
    result: "決定結果",
    bestFit: "最適候補",
    score: "LifeAtlas Score",
    gross: "年収",
    takeHome: "年間手取り",
    livingCost: "月間生活費",
    savings: "年間貯蓄",
    savingsRate: "貯蓄率",
    wealth10: "10年後資産",
    rentBurden: "家賃負担率",
    fire: "FIRE目安",
    unavailable: "計算対象外",
    years: "年",
    strongest: "強み",
    weakest: "注意点",
    confidence: "データ信頼度",
    dataHigh: "高",
    dataMedium: "中",
    dataLow: "低",
    official: "公式制度シナリオ",
    estimate: "公式税率による概算",
    taxUnavailable: "税・保険未対応",
    sourceRange: "データ範囲",
    whatIf: "What-If シミュレーター",
    whatIfNote: "元のオファーを変更せず、給与・家賃・為替の変化後を即時比較します。",
    target: "変更するオファー",
    salaryChange: "給与変化",
    rentChange: "家賃変化",
    fxChange: "為替変化",
    fxBase: "JPYは比較の基準通貨のため固定",
    reset: "変化をリセット",
    impact: "変化後の影響",
    rankChange: "順位変化",
    scoreChange: "スコア変化",
    savingsChange: "年間貯蓄差",
    wealthChange: "10年後資産差",
    breakEven: "逆転に必要な給与",
    breakEvenNote: "選択した候補が現在の1位と同水準になる給与を、決定的な数値探索で計算します。",
    candidate: "逆転させる候補",
    metric: "同水準にする指標",
    metricIncome: "年間手取り",
    metricSavings: "貯蓄率",
    metricScore: "LifeAtlas Score",
    requiredSalary: "必要な年間給与",
    already: "すでに基準を満たしています",
    unreachable: "設定上限内では到達できません",
    calculationUnavailable: "この組み合わせは税・保険計算が未対応です",
    disclaimer: "比較結果は公開情報と保存した参考値に基づく概算です。個別の控除、在留資格、雇用条件、医療保険等を完全には反映せず、税務・金融・移住助言ではありません。重要な判断では専門家と最新の公式情報をご確認ください。",
  },
  en: {
    back: "Back to city comparison",
    language: "日本語",
    theme: "Theme",
    eyebrow: "LifeAtlas Offer Analyzer",
    title: "See which offer makes your future stronger.",
    intro: "Compare two to five job or relocation options with the same calculation engine. Rankings come from taxes, living costs, savings and long-term wealth—not AI-generated numbers.",
    live: "Recalculates instantly",
    coverage: "50 global cities",
    scenarios: "Offers to compare",
    scenarioNote: "Enter each offer in its stated currency. If a city's tax system is unsupported, LifeAtlas will not invent take-home pay.",
    add: "Add offer",
    remove: "Remove",
    city: "City",
    salary: "Annual salary",
    bonus: "Annual bonus",
    age: "Age",
    household: "Household",
    single: "Single",
    couple: "Couple",
    children: "Children",
    housing: "Housing",
    lifestyle: "Lifestyle",
    customRent: "Monthly rent (optional)",
    customSpending: "Other monthly spending (optional)",
    savingsTarget: "Savings target (optional)",
    priorities: "What matters most?",
    prioritiesNote: "Zero excludes a priority; five makes it critical. Missing climate or other source data is shown as omitted rather than fabricated.",
    result: "Decision result",
    bestFit: "Best fit",
    score: "LifeAtlas Score",
    gross: "Gross income",
    takeHome: "Annual take-home",
    livingCost: "Monthly living cost",
    savings: "Annual savings",
    savingsRate: "Savings rate",
    wealth10: "Wealth after 10 years",
    rentBurden: "Rent burden",
    fire: "FIRE estimate",
    unavailable: "Unavailable",
    years: "years",
    strongest: "Strengths",
    weakest: "Watch-outs",
    confidence: "Data confidence",
    dataHigh: "High",
    dataMedium: "Medium",
    dataLow: "Low",
    official: "Verified official scenario",
    estimate: "Official-rate estimate",
    taxUnavailable: "Tax calculation unavailable",
    sourceRange: "Data scope",
    whatIf: "What-If simulator",
    whatIfNote: "Test salary, rent and exchange-rate changes without overwriting the original offers.",
    target: "Offer to change",
    salaryChange: "Salary change",
    rentChange: "Rent change",
    fxChange: "Exchange-rate change",
    fxBase: "JPY stays fixed as the comparison base",
    reset: "Reset changes",
    impact: "Impact after change",
    rankChange: "Rank change",
    scoreChange: "Score change",
    savingsChange: "Annual savings change",
    wealthChange: "10-year wealth change",
    breakEven: "Salary needed to overtake",
    breakEvenNote: "A deterministic numerical search finds the salary needed for the selected option to match the current winner.",
    candidate: "Option to improve",
    metric: "Metric to match",
    metricIncome: "Annual take-home",
    metricSavings: "Savings rate",
    metricScore: "LifeAtlas Score",
    requiredSalary: "Required annual salary",
    already: "This option already meets the target",
    unreachable: "The target is unreachable within the search limit",
    calculationUnavailable: "Tax and insurance calculations are unavailable for this option",
    disclaimer: "Results are estimates based on public sources and saved reference values. They do not fully reflect individual deductions, immigration status, employment terms or health coverage, and are not tax, financial or immigration advice. Confirm important decisions with professionals and current official sources.",
  },
} as const;

function cityName(city: City, language: Language) {
  return language === "ja" ? city.name : city.englishName ?? city.name;
}

function countryName(city: City, language: Language) {
  return language === "ja" ? city.country : city.englishCountry ?? city.country;
}

function formatMoney(value: number | null, currency: CurrencyCode, language: Language) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSigned(value: number | null, formatter: (amount: number) => string) {
  if (value === null) return "—";
  if (value === 0) return "±0";
  return `${value > 0 ? "+" : ""}${formatter(value)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function optionalNumber(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function makeScenario(index: number): ScenarioInput {
  const defaults: CityId[] = ["melbourne", "toronto", "london"];
  const cityId = defaults[index - 2] ?? cityOrder[index % cityOrder.length];
  const city = cities[cityId];
  return {
    id: `offer-${Date.now()}-${index}`,
    cityId,
    annualSalary: city.averageAnnualIncome,
    salaryCurrency: city.currency,
    age: 29,
    householdType: "single",
    children: 0,
    housing: "onebed",
    lifestyle: "balanced",
    retirementAge: 65,
    annualReturnRate: 0,
  };
}

export function OfferAnalyzer() {
  const [language, setLanguage] = useState<Language>("ja");
  const [darkMode, setDarkMode] = useState(true);
  const [scenarios, setScenarios] = useState<ScenarioInput[]>(initialScenarios);
  const [priorities, setPriorities] = useState<UserPriorities>(DEFAULT_PRIORITIES);
  const [whatIfScenarioId, setWhatIfScenarioId] = useState(initialScenarios[1].id);
  const [salaryPercent, setSalaryPercent] = useState(0);
  const [rentPercent, setRentPercent] = useState(0);
  const [exchangePercent, setExchangePercent] = useState(0);
  const [breakEvenCandidateId, setBreakEvenCandidateId] = useState(initialScenarios[1].id);
  const [breakEvenMetric, setBreakEvenMetric] = useState<BreakEvenMetric>("disposableIncome");
  const t = copy[language];

  const updateScenario = (id: string, patch: Partial<ScenarioInput>) => {
    setScenarios((current) => current.map((scenario) => scenario.id === id ? { ...scenario, ...patch } : scenario));
  };

  const activeWhatIfScenario = scenarios.find((scenario) => scenario.id === whatIfScenarioId) ?? scenarios[0];
  const whatIfChanges = useMemo(() => {
    const changes: WhatIfChange[] = [];
    if (salaryPercent !== 0) changes.push({ type: "salaryPercent", scenarioId: activeWhatIfScenario.id, percent: salaryPercent });
    if (rentPercent !== 0) changes.push({ type: "rentPercent", scenarioId: activeWhatIfScenario.id, percent: rentPercent });
    const currency = cities[activeWhatIfScenario.cityId].currency;
    if (exchangePercent !== 0 && currency !== "JPY") changes.push({ type: "exchangeRatePercent", currency, percent: exchangePercent });
    return changes;
  }, [activeWhatIfScenario, exchangePercent, rentPercent, salaryPercent]);

  const preview = useMemo(() => simulateWhatIf({ scenarios, changes: whatIfChanges, priorities }), [priorities, scenarios, whatIfChanges]);
  const winnerId = preview.after.scores[0].scenarioId;
  const candidateOptions = scenarios.filter((scenario) => scenario.id !== winnerId);
  const activeBreakEvenCandidateId = candidateOptions.some((scenario) => scenario.id === breakEvenCandidateId)
    ? breakEvenCandidateId
    : candidateOptions[0]?.id;
  const simulation = simulateWhatIf({
    scenarios,
    changes: whatIfChanges,
    priorities,
    breakEven: activeBreakEvenCandidateId ? [{ referenceScenarioId: winnerId, candidateScenarioId: activeBreakEvenCandidateId, metric: breakEvenMetric }] : [],
  });

  const resultById = new Map(simulation.after.results.map((result) => [result.scenarioId, result]));
  const inputById = new Map(simulation.after.inputs.map((input) => [input.id, input]));
  const deltaById = new Map(simulation.deltas.map((delta) => [delta.scenarioId, delta]));
  const winnerScore = simulation.after.scores[0];
  const winnerResult = resultById.get(winnerScore.scenarioId);
  const winnerCity = winnerResult ? cities[winnerResult.cityId] : cities.tokyo;
  const runnerUpScore = simulation.after.scores[1];
  const runnerUpResult = runnerUpScore ? resultById.get(runnerUpScore.scenarioId) : undefined;
  const savingsLead = winnerResult?.annualSavingsJpy !== null && winnerResult?.annualSavingsJpy !== undefined && runnerUpResult?.annualSavingsJpy !== null && runnerUpResult?.annualSavingsJpy !== undefined
    ? winnerResult.annualSavingsJpy - runnerUpResult.annualSavingsJpy
    : null;
  const breakEven = simulation.after.breakEven[0];

  const removeScenario = (id: string) => {
    if (scenarios.length <= 2) return;
    setScenarios((current) => current.filter((scenario) => scenario.id !== id));
    if (whatIfScenarioId === id) setWhatIfScenarioId(scenarios.find((scenario) => scenario.id !== id)?.id ?? scenarios[0].id);
  };

  const renderResultCard = (score: ScenarioScore) => {
    const result = resultById.get(score.scenarioId) as ScenarioResult;
    const input = inputById.get(score.scenarioId) as ScenarioInput;
    const city = cities[result.cityId];
    const delta = deltaById.get(score.scenarioId);
    const confidenceLabel = result.dataConfidence.level === "high" ? t.dataHigh : result.dataConfidence.level === "medium" ? t.dataMedium : t.dataLow;
    const taxLabel = result.calculationStatus === "official-scenario" ? t.official : result.calculationStatus === "official-rate-estimate" ? t.estimate : t.taxUnavailable;
    const fireLabel = result.fire?.yearsToTarget === null || result.fire === null ? t.unavailable : `${result.fire.yearsToTarget} ${t.years}`;

    return (
      <article className={`oa-result-card ${score.rank === 1 ? "is-winner" : ""}`} key={score.scenarioId} data-calculation-status={result.calculationStatus}>
        <div className="oa-result-top">
          <div className="oa-rank"><span>#{score.rank}</span>{score.rank === 1 && <strong>{t.bestFit}</strong>}</div>
          <div className="oa-city-title"><small>{countryName(city, language)}</small><h3>{cityName(city, language)}</h3></div>
          <div className="oa-score"><strong>{score.score}</strong><span>/ 100<br />{t.score}</span></div>
        </div>
        <div className="oa-metrics">
          <div><span>{t.gross}</span><strong>{formatMoney(result.grossAnnual, result.currency, language)}</strong></div>
          <div><span>{t.takeHome}</span><strong>{formatMoney(result.netAnnual, result.currency, language)}</strong></div>
          <div><span>{t.livingCost}</span><strong>{formatMoney(result.totalLivingCostMonthly, result.currency, language)}</strong></div>
          <div><span>{t.savings}</span><strong>{formatMoney(result.annualSavings, result.currency, language)}</strong></div>
          <div><span>{t.savingsRate}</span><strong>{formatPercent(result.savingsRate)}</strong></div>
          <div><span>{t.wealth10}</span><strong>{formatMoney(result.projectedSavings10Years, result.currency, language)}</strong></div>
          <div><span>{t.rentBurden}</span><strong>{formatPercent(result.rentBurden)}</strong></div>
          <div><span>{t.fire}</span><strong>{fireLabel}</strong></div>
        </div>
        <div className="oa-score-breakdown" aria-label={language === "ja" ? "スコア内訳" : "Score breakdown"}>
          <span>{language === "ja" ? "財務" : "Financial"}<strong>{score.contributions.financial}</strong></span>
          <span>{language === "ja" ? "生活" : "Lifestyle"}<strong>{score.contributions.lifestyle}</strong></span>
          <span>{language === "ja" ? "優先軸" : "Priorities"}<strong>{score.contributions.preference}</strong></span>
          <span>{language === "ja" ? "信頼度" : "Confidence"}<strong>{score.contributions.confidence}</strong></span>
        </div>
        <div className="oa-factors">
          <div><span>{t.strongest}</span><ul>{score.strongestFactors.map((factor) => <li key={factor}>{factorLabels[factor]?.[language] ?? factor}</li>)}</ul></div>
          <div><span>{t.weakest}</span><ul>{score.riskFlags.length > 0 ? score.riskFlags.map((risk) => <li key={risk}>{riskLabels[risk]?.[language] ?? risk}</li>) : score.weakestFactors.slice(0, 2).map((factor) => <li key={factor}>{factorLabels[factor]?.[language] ?? factor}</li>)}</ul></div>
        </div>
        <div className="oa-confidence">
          <span>{t.confidence}: <strong className={`is-${result.dataConfidence.level}`}>{confidenceLabel} · {result.dataConfidence.score}/100</strong></span>
          <span>{taxLabel}</span>
          <p><strong>{t.sourceRange}:</strong> {language === "ja" ? city.sourceLabel : `City inputs dated ${city.updatedAt}; tax status is shown separately.`}</p>
        </div>
        {whatIfChanges.length > 0 && delta && input.id === activeWhatIfScenario.id && (
          <div className="oa-card-delta"><span>{t.impact}</span><strong>{formatSigned(delta.score, (value) => value.toFixed(1))} pt</strong><small>{formatSigned(delta.rankChange, (value) => `${Math.abs(value).toFixed(0)}`)} {t.rankChange}</small></div>
        )}
      </article>
    );
  };

  return (
    <main lang={language} className={`app-shell oa-shell ${darkMode ? "is-dark" : "is-light"}`}>
      <header className="site-header oa-header">
        <Link className="brand" href="/" aria-label="Life Atlas"><span className="brand-mark" aria-hidden="true">✦</span><span>Life Atlas</span></Link>
        <nav className="desktop-nav" aria-label={language === "ja" ? "Offer Analyzerメニュー" : "Offer Analyzer navigation"}>
          <a href="#offers">{t.scenarios}</a><a href="#result">{t.result}</a><a href="#what-if">What-If</a><a href="#break-even">Break-even</a>
        </nav>
        <div className="header-actions"><Link className="oa-back-link" href="/">← {t.back}</Link><button className="language-button" type="button" onClick={() => setLanguage((current) => current === "ja" ? "en" : "ja")}>{t.language}</button><button className="theme-button" type="button" onClick={() => setDarkMode((current) => !current)}>{t.theme}</button></div>
      </header>

      <div className="page-wrap oa-wrap">
        <section className="oa-hero">
          <div><p className="eyebrow"><span className="eyebrow-dot" />{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></div>
          <div className="oa-hero-proof"><span><strong>2–5</strong>{language === "ja" ? "オファー" : "offers"}</span><span><strong>50</strong>{t.coverage}</span><span><strong>0</strong>{language === "ja" ? "AIによる数値生成" : "AI-made numbers"}</span></div>
          <div className="oa-live-badge"><i />{t.live}</div>
        </section>

        <section id="offers" className="oa-section oa-offers-section">
          <div className="oa-section-heading"><div><p className="eyebrow">01 / INPUT</p><h2>{t.scenarios}</h2></div><p>{t.scenarioNote}</p></div>
          <div className="oa-scenario-list">
            {scenarios.map((scenario, index) => {
              const city = cities[scenario.cityId];
              return <article className="oa-scenario-card" key={scenario.id}>
                <div className="oa-scenario-number"><span>0{index + 1}</span><div><small>{countryName(city, language)}</small><strong>{cityName(city, language)}</strong></div>{scenarios.length > 2 && <button type="button" onClick={() => removeScenario(scenario.id)}>{t.remove}</button>}</div>
                <div className="oa-form-grid">
                  <label>{t.city}<select value={scenario.cityId} onChange={(event) => { const cityId = event.target.value as CityId; const nextCity = cities[cityId]; updateScenario(scenario.id, { cityId, salaryCurrency: nextCity.currency, annualSalary: nextCity.averageAnnualIncome }); }}>
                    {cityOrder.map((cityId) => <option value={cityId} key={cityId}>{cityName(cities[cityId], language)} / {countryName(cities[cityId], language)}</option>)}
                  </select></label>
                  <label>{t.salary}<div className="input-with-unit"><input type="number" min="0" value={scenario.annualSalary} onChange={(event) => updateScenario(scenario.id, { annualSalary: Number(event.target.value) })} /><span>{scenario.salaryCurrency}</span></div></label>
                  <label>{t.bonus}<div className="input-with-unit"><input type="number" min="0" value={optionalNumber(scenario.bonus)} placeholder="0" onChange={(event) => updateScenario(scenario.id, { bonus: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{scenario.salaryCurrency}</span></div></label>
                  <label>{t.age}<input type="number" min="18" max="100" value={scenario.age} onChange={(event) => updateScenario(scenario.id, { age: Number(event.target.value) })} /></label>
                  <label>{t.household}<select value={scenario.householdType} onChange={(event) => updateScenario(scenario.id, { householdType: event.target.value as ScenarioHousehold })}><option value="single">{t.single}</option><option value="couple">{t.couple}</option></select></label>
                  <label>{t.children}<input type="number" min="0" max="10" value={scenario.children} onChange={(event) => updateScenario(scenario.id, { children: Number(event.target.value) })} /></label>
                  <label>{t.housing}<select value={scenario.housing} onChange={(event) => updateScenario(scenario.id, { housing: event.target.value as HousingType })}><option value="shared">{language === "ja" ? "シェア" : "Shared"}</option><option value="studio">{language === "ja" ? "ワンルーム" : "Studio"}</option><option value="onebed">{language === "ja" ? "1ベッド" : "1 bedroom"}</option><option value="condo">{language === "ja" ? "コンドミニアム" : "Condo"}</option><option value="twobed">{language === "ja" ? "2ベッド" : "2 bedrooms"}</option><option value="house">{language === "ja" ? "戸建て" : "House"}</option></select></label>
                  <label>{t.lifestyle}<select value={scenario.lifestyle} onChange={(event) => updateScenario(scenario.id, { lifestyle: event.target.value as LifestyleType })}><option value="lean">{language === "ja" ? "節約" : "Lean"}</option><option value="balanced">{language === "ja" ? "標準" : "Balanced"}</option><option value="comfortable">{language === "ja" ? "ゆとり" : "Comfortable"}</option></select></label>
                  <label>{t.customRent}<div className="input-with-unit"><input type="number" min="0" value={optionalNumber(scenario.customRent)} placeholder={language === "ja" ? "都市基準を使用" : "Use city baseline"} onChange={(event) => updateScenario(scenario.id, { customRent: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                  <label>{t.customSpending}<div className="input-with-unit"><input type="number" min="0" value={optionalNumber(scenario.customMonthlySpending)} placeholder={language === "ja" ? "都市基準を使用" : "Use city baseline"} onChange={(event) => updateScenario(scenario.id, { customMonthlySpending: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                  <label>{t.savingsTarget}<div className="input-with-unit"><input type="number" min="0" value={optionalNumber(scenario.customSavingsTarget)} placeholder="—" onChange={(event) => updateScenario(scenario.id, { customSavingsTarget: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                </div>
              </article>;
            })}
          </div>
          <button className="oa-add-button" type="button" disabled={scenarios.length >= 5} onClick={() => setScenarios((current) => [...current, makeScenario(current.length)])}>＋ {t.add}<small>{scenarios.length}/5</small></button>
        </section>

        <section className="oa-section oa-priority-section">
          <div className="oa-section-heading"><div><p className="eyebrow">02 / PRIORITIES</p><h2>{t.priorities}</h2></div><p>{t.prioritiesNote}</p></div>
          <div className="oa-priority-grid">{priorityOrder.map((priority) => <label className="oa-priority" key={priority}><span>{priorityLabels[priority][language]}<strong>{priorities[priority]}/5</strong></span><input type="range" min="0" max="5" step="1" value={priorities[priority]} onChange={(event) => setPriorities((current) => ({ ...current, [priority]: Number(event.target.value) }))} /></label>)}</div>
        </section>

        <section id="result" className="oa-section oa-result-section">
          <div className="oa-decision-banner"><div><p className="eyebrow">03 / DECISION</p><span>{t.bestFit}</span><h2>{cityName(winnerCity, language)}</h2><p>{savingsLead === null ? (language === "ja" ? "現在の優先軸とデータ信頼度を含めて最上位です。" : "It ranks first after your priorities and data confidence are applied.") : language === "ja" ? `2位より年間貯蓄が約${formatMoney(savingsLead, "JPY", language)}多い試算です。` : `Projected annual savings are about ${formatMoney(savingsLead, "JPY", language)} above the runner-up.`}</p></div><div className="oa-decision-score"><strong>{winnerScore.score}</strong><span>/ 100<br />{t.score}</span></div></div>
          <div className="oa-results-grid">{simulation.after.scores.map(renderResultCard)}</div>
        </section>

        <section id="what-if" className="oa-section oa-what-if-section">
          <div className="oa-section-heading"><div><p className="eyebrow">04 / SIMULATE</p><h2>{t.whatIf}</h2></div><p>{t.whatIfNote}</p></div>
          <div className="oa-what-if-controls">
            <label>{t.target}<select value={activeWhatIfScenario.id} onChange={(event) => setWhatIfScenarioId(event.target.value)}>{scenarios.map((scenario) => <option value={scenario.id} key={scenario.id}>{cityName(cities[scenario.cityId], language)}</option>)}</select></label>
            <label>{t.salaryChange}<div className="input-with-unit"><input type="number" min="-100" max="1000" value={salaryPercent} onChange={(event) => setSalaryPercent(Number(event.target.value))} /><span>%</span></div></label>
            <label>{t.rentChange}<div className="input-with-unit"><input type="number" min="-100" max="1000" value={rentPercent} onChange={(event) => setRentPercent(Number(event.target.value))} /><span>%</span></div></label>
            <label>{t.fxChange}<div className="input-with-unit"><input type="number" min="-99" max="1000" value={exchangePercent} disabled={cities[activeWhatIfScenario.cityId].currency === "JPY"} onChange={(event) => setExchangePercent(Number(event.target.value))} /><span>%</span></div><small>{cities[activeWhatIfScenario.cityId].currency === "JPY" ? t.fxBase : cities[activeWhatIfScenario.cityId].currency}</small></label>
          </div>
          <button className="secondary-button" type="button" onClick={() => { setSalaryPercent(0); setRentPercent(0); setExchangePercent(0); }}>{t.reset}</button>
          <div className="oa-impact-grid">{simulation.deltas.map((delta) => {
            const result = resultById.get(delta.scenarioId) as ScenarioResult;
            const city = cities[result.cityId];
            return <article key={delta.scenarioId} className={delta.scenarioId === activeWhatIfScenario.id ? "is-target" : ""}><span>{cityName(city, language)}</span><div><small>{t.rankChange}</small><strong>{formatSigned(delta.rankChange, (value) => Math.abs(value).toFixed(0))}</strong></div><div><small>{t.scoreChange}</small><strong>{formatSigned(delta.score, (value) => Math.abs(value).toFixed(1))}</strong></div><div><small>{t.savingsChange}</small><strong>{formatSigned(delta.annualSavings, (value) => formatMoney(Math.abs(value), result.currency, language))}</strong></div><div><small>{t.wealthChange}</small><strong>{formatSigned(delta.projectedSavings10Years, (value) => formatMoney(Math.abs(value), result.currency, language))}</strong></div></article>;
          })}</div>
        </section>

        <section id="break-even" className="oa-section oa-break-even-section">
          <div className="oa-section-heading"><div><p className="eyebrow">05 / BREAK-EVEN</p><h2>{t.breakEven}</h2></div><p>{t.breakEvenNote}</p></div>
          <div className="oa-break-even-grid"><label>{t.candidate}<select value={activeBreakEvenCandidateId} onChange={(event) => setBreakEvenCandidateId(event.target.value)}>{candidateOptions.map((scenario) => <option value={scenario.id} key={scenario.id}>{cityName(cities[scenario.cityId], language)}</option>)}</select></label><label>{t.metric}<select value={breakEvenMetric} onChange={(event) => setBreakEvenMetric(event.target.value as BreakEvenMetric)}><option value="disposableIncome">{t.metricIncome}</option><option value="savingsRate">{t.metricSavings}</option><option value="lifeAtlasScore">{t.metricScore}</option></select></label><div className="oa-break-even-result"><span>{t.requiredSalary}</span><strong>{breakEven?.status === "matched" ? formatMoney(breakEven.requiredAnnualSalary, breakEven.salaryCurrency, language) : "—"}</strong><small>{breakEven?.status === "unreachable" ? t.unreachable : breakEven?.status === "calculation-unavailable" ? t.calculationUnavailable : `${cityName(winnerCity, language)} · ${breakEvenMetric === "disposableIncome" ? t.metricIncome : breakEvenMetric === "savingsRate" ? t.metricSavings : t.metricScore}`}</small></div></div>
        </section>

        <aside className="oa-disclaimer" role="note"><strong>{language === "ja" ? "重要な前提" : "Important assumptions"}</strong><p>{t.disclaimer}</p></aside>
        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">✦</span><strong>Life Atlas</strong><p>The AI decision engine for where to live, work, and build wealth.</p></div><div className="footer-meta"><span>CALCULATION 2026.08-v2.1</span><Link href="/">{t.back}</Link></div></footer>
      </div>
    </main>
  );
}
