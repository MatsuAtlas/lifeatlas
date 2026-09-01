"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { cities, cityOrder } from "../../data/cities";
import { DEFAULT_PRIORITIES } from "../../lib/scoring/life-atlas-score";
import { localizedCity } from "../../lib/cities/localization";
import { trackProductEvent, trackProductEventOnce } from "../../lib/analytics/client";
import { simulateWhatIf } from "../../lib/calculations/what-if";
import { isUserProfile } from "../../lib/user-profile";
import { validateAIRecommendation } from "../../lib/ai/recommendation";
import { canCreateScenario, FREE_ENTITLEMENTS } from "../../lib/billing/entitlements";
import { buildAnalysisCsv } from "../../lib/reports/analysis-csv";
import { StandardDisclaimer } from "../financial/standard-disclaimer";
import {
  consumeQueuedAnalyzerRestore,
  isComparisonRecord,
  isSavedAnalyzerInput,
  LOCAL_HISTORY_KEY,
  LOCAL_HISTORY_LIMIT,
  localHistoryId,
  readLocalHistory,
  writeLocalHistory,
} from "../../lib/comparison-history";
import type { City, CityId, CurrencyCode } from "../../types/city";
import type { BreakEvenMetric } from "../../types/break-even";
import type { RecommendationGeneration } from "../../types/ai";
import type { BillingStatusResponse, Entitlements } from "../../types/billing";
import type { ComparisonRecord, SavedAnalyzerInput, SavedAnalyzerResult } from "../../types/comparison";
import type { HousingType, LifestyleType } from "../../types/finance";
import type { UserProfile } from "../../types/profile";
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
    applyProfile: "保存プロフィールを適用",
    profileApplied: "保存プロフィールの世帯条件・現在都市・優先軸を適用しました。",
    setProfile: "プロフィールを設定",
    result: "決定結果",
    bestFit: "最適候補",
    score: "LifeAtlas Score",
    gross: "年収",
    grossMonthly: "月収（総額）",
    taxAnnual: "年間税額",
    insuranceAnnual: "年間社会保険",
    takeHome: "年間手取り",
    takeHomeMonthly: "月間手取り",
    livingCost: "月間生活費",
    rent: "月額家賃",
    otherSpending: "家賃以外の月額支出",
    monthlySurplus: "月間余剰",
    savings: "年間貯蓄",
    savingsRate: "貯蓄率",
    wealth10: "10年後資産",
    wealth5: "5年後資産",
    rentBurden: "家賃負担率",
    livingCostBurden: "生活費負担率",
    purchasingPower: "購買力指数",
    fire: "FIRE目安",
    fullBreakdown: "収入・控除・生活費の全明細",
    costBreakdown: "月間生活費の内訳",
    food: "食費",
    utilities: "光熱費",
    internet: "通信費",
    transportation: "交通費",
    healthcare: "医療費目安",
    leisure: "その他生活費",
    customOther: "カスタム支出合計",
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
    whatIfNote: "元のオファーを変更せず、給与・家賃・為替・世帯・支出・長期条件の変化後を即時比較します。",
    target: "変更するオファー",
    salaryChange: "給与変化",
    rentChange: "家賃変化",
    fxChange: "為替変化",
    fxBase: "JPYは比較の基準通貨のため固定",
    unchanged: "変更なし",
    whatIfHousehold: "変更後の世帯",
    whatIfChildren: "変更後の子ども",
    whatIfSpending: "変更後の月額支出",
    whatIfSavingsTarget: "変更後の貯蓄目標",
    whatIfRetirementAge: "変更後の退職年齢",
    whatIfReturnRate: "変更後の年利",
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
    saveTitle: "分析を保存する",
    saveNote: "Freeは1件、Proは無制限にアカウント保存できます。Supabase未設定時だけ、この端末へ最大50件保存します。",
    saveAnalysis: "現在の分析を保存",
    savedAnalyses: "保存済みの分析",
    noSavedAnalyses: "保存済みのOffer Analyzer分析はありません。",
    restore: "復元",
    delete: "削除",
    signInRequired: "アカウント保存にはログインが必要です。",
    signInLink: "ログイン画面へ",
    signedInAs: "ログイン中",
    localMode: "端末保存モード",
    cloudMode: "アカウント保存モード",
    saved: "分析を保存しました。",
    restored: "保存した条件を復元しました。",
    deleted: "保存した分析を削除しました。",
    invalidSavedAnalysis: "保存内容を確認できませんでした。",
    saveError: "保存履歴を処理できませんでした。",
    loading: "処理中…",
    shareTitle: "結果を公開共有する",
    shareNote: "Proでは、氏名・メール・年齢・世帯・カスタム支出を含まない公開スナップショットを作成できます。",
    createShare: "公開リンクを作成",
    creatingShare: "公開リンクを作成中…",
    copyShare: "リンクをコピー",
    shareCreated: "公開リンクを作成しました。",
    shareCopied: "公開リンクをコピーしました。",
    shareError: "公開リンクを作成できませんでした。",
    downloadTitle: "計算結果をダウンロードする",
    downloadNote: "Proでは、表示中の計算結果・スコア・逆転給与・データ範囲を日本語または英語のCSVに保存できます。AIは使いません。",
    downloadCsv: "CSVをダウンロード",
    downloaded: "計算結果のCSVをダウンロードしました。",
    downloadError: "CSVを作成できませんでした。",
    aiTitle: "AIに結果を説明してもらう",
    aiNote: "順位・金額はLifeAtlasの計算結果を固定したまま、AIが理由・トレードオフ・不確実性を読みやすく整理します。",
    generateAI: "構造化AI説明を生成",
    generatingAI: "説明を生成中…",
    aiAccountRequired: "AI説明はログイン後に利用できます。",
    aiUnavailable: "AI説明は現在準備中です。決定結果・What-If・逆転給与はそのまま利用できます。",
    aiLimit: "AI説明の24時間上限に達しました。",
    aiError: "AI説明を生成できませんでした。計算結果はそのまま利用できます。",
    aiPrivacy: "生成時には、この分析の給与・世帯・都市・計算結果だけをAIサービスへ送信します。氏名やメールアドレスは送りません。",
    aiCached: "同じ条件の保存済み説明を再利用しました",
    aiFresh: "新しい説明を生成しました",
    aiReasons: "この順位になる理由",
    aiTradeoffs: "候補ごとのトレードオフ",
    advantages: "利点",
    disadvantages: "注意点",
    aiRisks: "不確実性と確認事項",
    aiNext: "次に確認できる質問",
    followUp: "追加で質問する",
    followUpPlaceholder: "例：家賃が10%上がる場合、どの注意点が重要ですか？",
    askAI: "質問を送る",
    aiDisclaimer: "AIはLifeAtlasの構造化された計算結果のみを説明します。未計算の税率・控除・移住条件を推測せず、専門的な税務・金融・移住助言を提供しません。",
    proRequired: "この機能はLifeAtlas Proで利用できます。",
    upgrade: "Proの機能を見る",
    scenarioLimit: "Freeは2件、Proは最大5件のオファーを比較できます。",
    longTermPro: "長期資産・FIREはProで表示",
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
    applyProfile: "Apply saved profile",
    profileApplied: "Saved household details, current city and priorities applied.",
    setProfile: "Set up profile",
    result: "Decision result",
    bestFit: "Best fit",
    score: "LifeAtlas Score",
    gross: "Gross income",
    grossMonthly: "Gross monthly income",
    taxAnnual: "Annual tax",
    insuranceAnnual: "Annual social insurance",
    takeHome: "Annual take-home",
    takeHomeMonthly: "Monthly take-home",
    livingCost: "Monthly living cost",
    rent: "Monthly rent",
    otherSpending: "Other monthly spending",
    monthlySurplus: "Monthly surplus",
    savings: "Annual savings",
    savingsRate: "Savings rate",
    wealth10: "Wealth after 10 years",
    wealth5: "Wealth after 5 years",
    rentBurden: "Rent burden",
    livingCostBurden: "Living-cost burden",
    purchasingPower: "Purchasing power index",
    fire: "FIRE estimate",
    fullBreakdown: "Full income, deduction and cost details",
    costBreakdown: "Monthly living-cost breakdown",
    food: "Food",
    utilities: "Utilities",
    internet: "Internet",
    transportation: "Transportation",
    healthcare: "Healthcare estimate",
    leisure: "Other living costs",
    customOther: "Custom spending total",
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
    whatIfNote: "Test salary, rent, exchange-rate, household, spending and long-term changes without overwriting the original offers.",
    target: "Offer to change",
    salaryChange: "Salary change",
    rentChange: "Rent change",
    fxChange: "Exchange-rate change",
    fxBase: "JPY stays fixed as the comparison base",
    unchanged: "No change",
    whatIfHousehold: "Household after change",
    whatIfChildren: "Children after change",
    whatIfSpending: "Monthly spending after change",
    whatIfSavingsTarget: "Savings target after change",
    whatIfRetirementAge: "Retirement age after change",
    whatIfReturnRate: "Annual return after change",
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
    saveTitle: "Save this analysis",
    saveNote: "Free saves 1 analysis; Pro saves unlimited analyses. Only unconfigured environments use up to 50 on-device records.",
    saveAnalysis: "Save current analysis",
    savedAnalyses: "Saved analyses",
    noSavedAnalyses: "No saved Offer Analyzer analyses yet.",
    restore: "Restore",
    delete: "Delete",
    signInRequired: "Sign in to save this analysis to your account.",
    signInLink: "Go to sign in",
    signedInAs: "Signed in",
    localMode: "On-device storage",
    cloudMode: "Account storage",
    saved: "Analysis saved.",
    restored: "Saved conditions restored.",
    deleted: "Saved analysis deleted.",
    invalidSavedAnalysis: "This saved analysis could not be verified.",
    saveError: "Saved analyses could not be processed.",
    loading: "Working…",
    shareTitle: "Share a public result",
    shareNote: "Pro creates a public snapshot without your name, email, age, household or custom spending.",
    createShare: "Create public link",
    creatingShare: "Creating public link…",
    copyShare: "Copy link",
    shareCreated: "Public link created.",
    shareCopied: "Public link copied.",
    shareError: "The public link could not be created.",
    downloadTitle: "Download the calculated result",
    downloadNote: "Pro saves the visible calculations, scores, break-even salary and data scope as a Japanese or English CSV. It does not use AI.",
    downloadCsv: "Download CSV",
    downloaded: "The calculated CSV has been downloaded.",
    downloadError: "The CSV could not be created.",
    aiTitle: "Ask AI to explain the result",
    aiNote: "LifeAtlas keeps every rank and number fixed while AI organizes the reasons, trade-offs and uncertainty into plain language.",
    generateAI: "Generate structured AI explanation",
    generatingAI: "Generating explanation…",
    aiAccountRequired: "Sign in to use AI explanations.",
    aiUnavailable: "AI explanations are not configured yet. Your decision result, What-If and break-even salary remain available.",
    aiLimit: "You have reached the AI explanation limit for the last 24 hours.",
    aiError: "The AI explanation could not be generated. Your calculated results remain available.",
    aiPrivacy: "Generation sends only this analysis's salary, household, cities and calculated results to the AI service. Your name and email are not sent.",
    aiCached: "Reused the saved explanation for these conditions",
    aiFresh: "Generated a new explanation",
    aiReasons: "Why this option ranks first",
    aiTradeoffs: "Trade-offs by option",
    advantages: "Advantages",
    disadvantages: "Watch-outs",
    aiRisks: "Uncertainty and checks",
    aiNext: "Useful follow-up questions",
    followUp: "Ask a follow-up",
    followUpPlaceholder: "Example: Which risk matters most if rent rises by 10%?",
    askAI: "Send question",
    aiDisclaimer: "AI only explains LifeAtlas's structured calculation result. It does not guess missing tax rates, deductions or immigration rules, and it does not provide professional tax, financial or immigration advice.",
    proRequired: "This feature is available with LifeAtlas Pro.",
    upgrade: "See Pro features",
    scenarioLimit: "Free compares 2 offers; Pro compares up to 5.",
    longTermPro: "Long-term wealth and FIRE are included with Pro",
  },
} as const;

function cityName(city: City, language: Language) {
  return localizedCity(city, language).name;
}

function countryName(city: City, language: Language) {
  return localizedCity(city, language).country;
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

function isRecommendationGeneration(
  value: unknown,
  winnerScenarioId: string,
  scenarioIds: string[],
): value is RecommendationGeneration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const generation = value as Partial<RecommendationGeneration>;
  return typeof generation.id === "string"
    && typeof generation.model === "string"
    && typeof generation.cached === "boolean"
    && typeof generation.createdAt === "string"
    && typeof generation.usage === "object"
    && generation.usage !== null
    && validateAIRecommendation(generation.recommendation, winnerScenarioId, scenarioIds);
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

export function OfferAnalyzer({ initialRecordId }: { initialRecordId?: string } = {}) {
  const [language, setLanguage] = useState<Language>("ja");
  const [darkMode, setDarkMode] = useState(true);
  const [scenarios, setScenarios] = useState<ScenarioInput[]>(initialScenarios);
  const [priorities, setPriorities] = useState<UserPriorities>(DEFAULT_PRIORITIES);
  const [whatIfScenarioId, setWhatIfScenarioId] = useState(initialScenarios[1].id);
  const [salaryPercent, setSalaryPercent] = useState(0);
  const [rentPercent, setRentPercent] = useState(0);
  const [exchangePercent, setExchangePercent] = useState(0);
  const [whatIfHousehold, setWhatIfHousehold] = useState<ScenarioHousehold | null>(null);
  const [whatIfChildren, setWhatIfChildren] = useState<number | null>(null);
  const [whatIfSpending, setWhatIfSpending] = useState<number | null>(null);
  const [whatIfSavingsTarget, setWhatIfSavingsTarget] = useState<number | null>(null);
  const [whatIfRetirementAge, setWhatIfRetirementAge] = useState<number | null>(null);
  const [whatIfReturnRatePercent, setWhatIfReturnRatePercent] = useState<number | null>(null);
  const [breakEvenCandidateId, setBreakEvenCandidateId] = useState(initialScenarios[1].id);
  const [breakEvenMetric, setBreakEvenMetric] = useState<BreakEvenMetric>("disposableIncome");
  const [authUser, setAuthUser] = useState<{ id: string; email?: string } | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>({ ...FREE_ENTITLEMENTS });
  const [profileDefaults, setProfileDefaults] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<ComparisonRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [aiGeneration, setAiGeneration] = useState<RecommendationGeneration | null>(null);
  const [aiGenerationLanguage, setAiGenerationLanguage] = useState<Language | null>(null);
  const [aiAnalysisSignature, setAiAnalysisSignature] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const t = copy[language];
  const activeEntitlements = authUser ? entitlements : FREE_ENTITLEMENTS;

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previousLanguage; };
  }, [language]);

  useEffect(() => {
    trackProductEventOnce("analyzer_started");
    trackProductEventOnce("first_scenario_created", { source: "default" });
    trackProductEventOnce("second_scenario_created", { source: "default" });
    const result = document.getElementById("result");
    if (!result || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackProductEventOnce("analysis_completed");
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(result);
    return () => observer.disconnect();
  }, []);

  const loadCloudHistory = useCallback(async () => {
    if (!supabaseConfigured) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setHistory(Array.isArray(data?.history) ? data.history.filter(isComparisonRecord).slice(0, LOCAL_HISTORY_LIMIT) : []);
      } else if (response.status === 503 && data?.configured === false) {
        setAuthUser(null);
        setSupabaseConfigured(false);
        setHistory(readLocalHistory());
        setSaveMessage(t.localMode);
      } else if (response.status !== 401) {
        setSaveMessage(data?.error ?? t.saveError);
      }
    } catch {
      setSaveMessage(t.saveError);
    } finally {
      setHistoryLoading(false);
    }
  }, [supabaseConfigured, t.localMode, t.saveError]);

  useEffect(() => {
    if (!supabaseConfigured) {
      const syncLocalHistory = (event?: StorageEvent) => {
        if (!event || event.key === null || event.key === LOCAL_HISTORY_KEY) setHistory(readLocalHistory());
      };
      syncLocalHistory();
      window.addEventListener("storage", syncLocalHistory);
      return () => window.removeEventListener("storage", syncLocalHistory);
    }

    void fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (response.status === 503 && data?.configured === false) {
          setAuthUser(null);
          setSupabaseConfigured(false);
          setHistory(readLocalHistory());
          return;
        }
        if (data?.user) {
          setEntitlements({ ...FREE_ENTITLEMENTS });
          setAuthUser(data.user);
          void fetch("/api/billing/status", { cache: "no-store" })
            .then(async (billingResponse) => ({ billingResponse, billingData: await billingResponse.json().catch(() => null) }))
            .then(({ billingResponse, billingData }) => {
              if (billingResponse.ok && billingData?.entitlements) setEntitlements((billingData as BillingStatusResponse).entitlements);
            })
            .catch(() => undefined);
          void fetch("/api/profile", { cache: "no-store" })
            .then(async (profileResponse) => ({ profileResponse, profileData: await profileResponse.json().catch(() => null) }))
            .then(({ profileResponse, profileData }) => {
              if (profileResponse.ok && isUserProfile(profileData?.profile)) setProfileDefaults(profileData.profile);
            })
            .catch(() => undefined);
          void loadCloudHistory();
        }
      })
      .catch(() => undefined);
  }, [loadCloudHistory, supabaseConfigured]);

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
    if (whatIfHousehold !== null) changes.push({ type: "household", scenarioId: activeWhatIfScenario.id, householdType: whatIfHousehold });
    if (whatIfChildren !== null) changes.push({ type: "children", scenarioId: activeWhatIfScenario.id, value: whatIfChildren });
    if (whatIfSpending !== null) changes.push({ type: "customMonthlySpending", scenarioId: activeWhatIfScenario.id, value: whatIfSpending });
    if (whatIfSavingsTarget !== null) changes.push({ type: "customSavingsTarget", scenarioId: activeWhatIfScenario.id, value: whatIfSavingsTarget });
    if (whatIfRetirementAge !== null && whatIfRetirementAge >= activeWhatIfScenario.age) changes.push({ type: "retirementAge", scenarioId: activeWhatIfScenario.id, value: whatIfRetirementAge });
    if (whatIfReturnRatePercent !== null) changes.push({ type: "annualReturnRate", scenarioId: activeWhatIfScenario.id, value: whatIfReturnRatePercent / 100 });
    return changes;
  }, [activeWhatIfScenario, exchangePercent, rentPercent, salaryPercent, whatIfChildren, whatIfHousehold, whatIfRetirementAge, whatIfReturnRatePercent, whatIfSavingsTarget, whatIfSpending]);

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
  const analyzerHistory = history.filter((record) => isSavedAnalyzerInput(record.input));
  const currentAnalysis: SavedAnalyzerInput = {
    kind: "offer-analyzer",
    version: 1,
    scenarios: scenarios.map((scenario) => ({ ...scenario })),
    priorities: { ...priorities },
    whatIf: {
      scenarioId: activeWhatIfScenario.id,
      salaryPercent,
      rentPercent,
      exchangePercent,
      householdType: whatIfHousehold,
      children: whatIfChildren,
      customMonthlySpending: whatIfSpending,
      customSavingsTarget: whatIfSavingsTarget,
      retirementAge: whatIfRetirementAge,
      annualReturnRatePercent: whatIfReturnRatePercent,
    },
    breakEven: {
      candidateScenarioId: activeBreakEvenCandidateId ?? scenarios[0].id,
      metric: breakEvenMetric,
    },
  };
  const currentAnalysisSignature = JSON.stringify(currentAnalysis);
  const visibleAIGeneration = aiGenerationLanguage === language && aiAnalysisSignature === currentAnalysisSignature ? aiGeneration : null;

  const applySavedInput = useCallback((saved: SavedAnalyzerInput, maxScenarios = activeEntitlements.maxScenarios) => {
    if (saved.scenarios.length > maxScenarios) {
      setSaveMessage(t.scenarioLimit);
      return;
    }
    setScenarios(saved.scenarios.map((scenario) => ({ ...scenario })));
    setPriorities({ ...saved.priorities });
    setWhatIfScenarioId(saved.whatIf.scenarioId);
    setSalaryPercent(saved.whatIf.salaryPercent);
    setRentPercent(saved.whatIf.rentPercent);
    setExchangePercent(saved.whatIf.exchangePercent);
    setWhatIfHousehold(saved.whatIf.householdType ?? null);
    setWhatIfChildren(saved.whatIf.children ?? null);
    setWhatIfSpending(saved.whatIf.customMonthlySpending ?? null);
    setWhatIfSavingsTarget(saved.whatIf.customSavingsTarget ?? null);
    setWhatIfRetirementAge(saved.whatIf.retirementAge ?? null);
    setWhatIfReturnRatePercent(saved.whatIf.annualReturnRatePercent ?? null);
    setBreakEvenCandidateId(saved.breakEven.candidateScenarioId);
    setBreakEvenMetric(saved.breakEven.metric);
    setSaveMessage(t.restored);
    requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [activeEntitlements.maxScenarios, t.restored, t.scenarioLimit]);

  useEffect(() => {
    const queued = consumeQueuedAnalyzerRestore();
    if (!queued || !isSavedAnalyzerInput(queued.input)) return;
    const frame = requestAnimationFrame(() => applySavedInput(queued.input as SavedAnalyzerInput));
    return () => cancelAnimationFrame(frame);
  }, [applySavedInput]);

  useEffect(() => {
    if (!initialRecordId) return;
    let active = true;
    void Promise.all([
      fetch(`/api/history?id=${encodeURIComponent(initialRecordId)}`, { cache: "no-store" }),
      fetch("/api/billing/status", { cache: "no-store" }),
    ]).then(async ([historyResponse, billingResponse]) => {
      const historyData = await historyResponse.json().catch(() => null);
      const billingData = await billingResponse.json().catch(() => null);
      if (!active) return;
      const record = historyData?.record;
      if (!historyResponse.ok || !isComparisonRecord(record) || !isSavedAnalyzerInput(record.input)) {
        setSaveMessage(t.invalidSavedAnalysis);
        return;
      }
      const maxScenarios = billingResponse.ok && typeof billingData?.entitlements?.maxScenarios === "number"
        ? billingData.entitlements.maxScenarios
        : FREE_ENTITLEMENTS.maxScenarios;
      applySavedInput(record.input, maxScenarios);
    }).catch(() => { if (active) setSaveMessage(t.saveError); });
    return () => { active = false; };
  }, [applySavedInput, initialRecordId, t.invalidSavedAnalysis, t.saveError]);

  const saveCurrentAnalysis = async () => {
    if (historyLoading) return;
    setSaveMessage(null);
    const savedResult: SavedAnalyzerResult = {
      kind: "offer-analyzer",
      version: 1,
      calculatedAt: new Date().toISOString(),
      snapshot: simulation.after,
      deltas: simulation.deltas,
    };
    const title = scenarios.map((scenario) => cityName(cities[scenario.cityId], language)).join(" vs ").slice(0, 120);
    const recordBase = {
      title,
      origin_city: scenarios[0].cityId,
      destination_city: scenarios[1].cityId,
      input: currentAnalysis as unknown as Record<string, unknown>,
      result: savedResult as unknown as Record<string, unknown>,
      created_at: savedResult.calculatedAt,
    };
    const saveLocally = () => {
      const localRecord: ComparisonRecord = { id: localHistoryId(), ...recordBase };
      const next = [localRecord, ...readLocalHistory()].slice(0, LOCAL_HISTORY_LIMIT);
      if (!writeLocalHistory(next)) {
        setSaveMessage(t.saveError);
        return;
      }
      setHistory(next);
      setSaveMessage(t.saved);
      trackProductEvent("saved_comparison", { storage: "device", scenarios: scenarios.length });
    };

    if (supabaseConfigured && authUser) {
      setHistoryLoading(true);
      try {
        const response = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recordBase),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 503 && data?.configured === false) {
            setAuthUser(null);
            setSupabaseConfigured(false);
            saveLocally();
            return;
          }
          setSaveMessage(data?.error ?? t.saveError);
          return;
        }
        if (isComparisonRecord(data?.record)) setHistory((current) => [data.record, ...current].slice(0, LOCAL_HISTORY_LIMIT));
        setSaveMessage(t.saved);
        trackProductEvent("saved_comparison", { storage: "account", scenarios: scenarios.length });
      } catch {
        setSaveMessage(t.saveError);
      } finally {
        setHistoryLoading(false);
      }
      return;
    }

    if (supabaseConfigured) {
      setSaveMessage(t.signInRequired);
      return;
    }
    saveLocally();
  };

  const generateAIRecommendation = async (question?: string) => {
    if (aiLoading) return;
    if (!authUser) {
      setAiError(t.aiAccountRequired);
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, analysis: currentAnalysis, ...(question ? { followUpQuestion: question } : {}) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) setAuthUser(null);
        setAiError(response.status === 401
          ? t.aiAccountRequired
          : response.status === 429
            ? t.aiLimit
            : response.status === 503
              ? t.aiUnavailable
              : t.aiError);
        return;
      }
      if (!isRecommendationGeneration(data?.generation, winnerScore.scenarioId, scenarios.map((scenario) => scenario.id))) {
        setAiError(t.aiError);
        return;
      }
      setAiGeneration(data.generation);
      setAiGenerationLanguage(language);
      setAiAnalysisSignature(currentAnalysisSignature);
      setFollowUpQuestion("");
      trackProductEvent("ai_recommendation_viewed", { cached: data.generation.cached, followUp: Boolean(question) });
    } catch {
      setAiError(t.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  const restoreAnalysis = (record: ComparisonRecord) => {
    if (!isSavedAnalyzerInput(record.input)) {
      setSaveMessage(t.invalidSavedAnalysis);
      return;
    }
    applySavedInput(record.input);
    setHistoryOpen(false);
  };

  const deleteAnalysis = async (record: ComparisonRecord) => {
    setSaveMessage(null);
    if (supabaseConfigured && authUser && !record.id.startsWith("local-")) {
      setHistoryLoading(true);
      try {
        const response = await fetch(`/api/history?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 503 && data?.configured === false) {
            setAuthUser(null);
            setSupabaseConfigured(false);
            setHistory(readLocalHistory());
            setSaveMessage(t.localMode);
            return;
          }
          setSaveMessage(data?.error ?? t.saveError);
          return;
        }
      } catch {
        setSaveMessage(t.saveError);
        return;
      } finally {
        setHistoryLoading(false);
      }
    }
    const next = history.filter((item) => item.id !== record.id);
    if (!supabaseConfigured && !writeLocalHistory(next)) {
      setSaveMessage(t.saveError);
      return;
    }
    setHistory(next);
    setSaveMessage(t.deleted);
  };

  const removeScenario = (id: string) => {
    if (scenarios.length <= 2) return;
    setScenarios((current) => current.filter((scenario) => scenario.id !== id));
    if (whatIfScenarioId === id) setWhatIfScenarioId(scenarios.find((scenario) => scenario.id !== id)?.id ?? scenarios[0].id);
  };

  const applyProfileDefaults = () => {
    if (!profileDefaults) return;
    const currentCity = cities[profileDefaults.currentCity];
    setScenarios((current) => current.map((scenario, index) => index === 0 ? {
      ...scenario,
      cityId: profileDefaults.currentCity,
      annualSalary: currentCity.averageAnnualIncome,
      salaryCurrency: currentCity.currency,
      age: profileDefaults.age,
      householdType: profileDefaults.householdType,
      children: profileDefaults.children,
    } : {
      ...scenario,
      age: profileDefaults.age,
      householdType: profileDefaults.householdType,
      children: profileDefaults.children,
    }));
    setPriorities({ ...profileDefaults.priorities });
    setSaveMessage(t.profileApplied);
  };

  const createShare = async () => {
    if (shareLoading) return;
    trackProductEvent("share_clicked", { action: "create", scenarios: scenarios.length });
    setShareLoading(true);
    setShareUrl(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, analysis: currentAnalysis }),
      });
      const data: unknown = await response.json().catch(() => null);
      const path = data && typeof data === "object" && !Array.isArray(data) ? (data as { path?: unknown }).path : null;
      if (!response.ok || typeof path !== "string" || !/^\/share\/[A-Za-z0-9_-]{16}$/.test(path)) throw new Error("SHARE_CREATE_FAILED");
      setShareUrl(`${window.location.origin}${path}`);
      setSaveMessage(t.shareCreated);
    } catch {
      setSaveMessage(t.shareError);
    } finally {
      setShareLoading(false);
    }
  };

  const downloadAnalysis = () => {
    try {
      const csv = buildAnalysisCsv(language, currentAnalysis, simulation.after);
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lifeatlas-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSaveMessage(t.downloaded);
      trackProductEvent("analysis_downloaded", { language, scenarios: scenarios.length });
    } catch {
      setSaveMessage(t.downloadError);
    }
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSaveMessage(t.shareCopied);
      trackProductEvent("share_clicked", { action: "copy" });
    } catch {
      setSaveMessage(t.shareError);
    }
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
          <div title={!activeEntitlements.canUseLongTermProjections ? t.longTermPro : undefined}><span>{t.wealth10}</span><strong>{activeEntitlements.canUseLongTermProjections ? formatMoney(result.projectedSavings10Years, result.currency, language) : "Pro"}</strong></div>
          <div><span>{t.rentBurden}</span><strong>{formatPercent(result.rentBurden)}</strong></div>
          <div title={!activeEntitlements.canUseLongTermProjections ? t.longTermPro : undefined}><span>{t.fire}</span><strong>{activeEntitlements.canUseLongTermProjections ? fireLabel : "Pro"}</strong></div>
        </div>
        <div className="oa-score-breakdown" aria-label={language === "ja" ? "スコア内訳" : "Score breakdown"}>
          <span>{language === "ja" ? "財務" : "Financial"}<strong>{score.contributions.financial}</strong></span>
          <span>{language === "ja" ? "生活" : "Lifestyle"}<strong>{score.contributions.lifestyle}</strong></span>
          <span>{language === "ja" ? "優先軸" : "Priorities"}<strong>{score.contributions.preference}</strong></span>
          <span>{language === "ja" ? "信頼度" : "Confidence"}<strong>{score.contributions.confidence}</strong></span>
        </div>
        <details className="oa-result-details">
          <summary>{t.fullBreakdown}</summary>
          <div className="oa-detail-metrics">
            <div><span>{t.grossMonthly}</span><strong>{formatMoney(result.grossMonthly, result.currency, language)}</strong></div>
            <div><span>{t.taxAnnual}</span><strong>{formatMoney(result.taxAnnual, result.currency, language)}</strong></div>
            <div><span>{t.insuranceAnnual}</span><strong>{formatMoney(result.socialInsuranceAnnual, result.currency, language)}</strong></div>
            <div><span>{t.takeHomeMonthly}</span><strong>{formatMoney(result.netMonthly, result.currency, language)}</strong></div>
            <div><span>{t.rent}</span><strong>{formatMoney(result.rentMonthly, result.currency, language)}</strong></div>
            <div><span>{t.otherSpending}</span><strong>{formatMoney(result.baselineSpendingMonthly, result.currency, language)}</strong></div>
            <div><span>{t.monthlySurplus}</span><strong>{formatMoney(result.monthlySurplus, result.currency, language)}</strong></div>
            <div><span>{t.livingCostBurden}</span><strong>{formatPercent(result.livingCostBurden)}</strong></div>
            <div><span>{t.purchasingPower}</span><strong>{result.purchasingPowerIndex ?? "—"}</strong></div>
            <div><span>{t.wealth5}</span><strong>{activeEntitlements.canUseLongTermProjections ? formatMoney(result.projectedSavings5Years, result.currency, language) : "Pro"}</strong></div>
          </div>
          <h4>{t.costBreakdown}</h4>
          <div className="oa-cost-breakdown">
            {(result.costBreakdownMonthly.source === "custom-total" ? [
              [t.customOther, result.costBreakdownMonthly.customOther],
            ] : [
              [t.food, result.costBreakdownMonthly.food],
              [t.utilities, result.costBreakdownMonthly.utilities],
              [t.internet, result.costBreakdownMonthly.internet],
              [t.transportation, result.costBreakdownMonthly.transportation],
              [t.healthcare, result.costBreakdownMonthly.healthcare],
              [t.leisure, result.costBreakdownMonthly.leisure],
            ]).map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{formatMoney(value as number | null, result.currency, language)}</strong></div>)}
          </div>
        </details>
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
          <a href="#offers">{t.scenarios}</a><a href="#result">{t.result}</a><a href="#what-if">What-If</a><a href="#break-even">Break-even</a><a href="#save">{language === "ja" ? "保存" : "Save"}</a><a href="#ai">AI</a><Link href="/pricing">Pro</Link>
        </nav>
        <div className="header-actions"><Link className="oa-back-link" href="/">← {t.back}</Link><button className="language-button" type="button" onClick={() => setLanguage((current) => current === "ja" ? "en" : "ja")}>{t.language}</button><button className="theme-button" type="button" onClick={() => setDarkMode((current) => !current)}>{t.theme}</button></div>
      </header>

      <div className="page-wrap oa-wrap">
        <section className="oa-hero">
          <div><p className="eyebrow"><span className="eyebrow-dot" />{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></div>
          <div className="oa-hero-proof"><span><strong>2–{activeEntitlements.maxScenarios}</strong>{language === "ja" ? "オファー" : "offers"}</span><span><strong>50</strong>{t.coverage}</span><span><strong>0</strong>{language === "ja" ? "AIによる数値生成" : "AI-made numbers"}</span></div>
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
                  <label>{t.customRent}<div className="input-with-unit"><input type="number" min="0" disabled={!activeEntitlements.canUseCustomAssumptions} value={optionalNumber(scenario.customRent)} placeholder={language === "ja" ? "Proでカスタム設定" : "Custom with Pro"} onChange={(event) => updateScenario(scenario.id, { customRent: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                  <label>{t.customSpending}<div className="input-with-unit"><input type="number" min="0" disabled={!activeEntitlements.canUseCustomAssumptions} value={optionalNumber(scenario.customMonthlySpending)} placeholder={language === "ja" ? "Proでカスタム設定" : "Custom with Pro"} onChange={(event) => updateScenario(scenario.id, { customMonthlySpending: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                  <label>{t.savingsTarget}<div className="input-with-unit"><input type="number" min="0" disabled={!activeEntitlements.canUseCustomAssumptions} value={optionalNumber(scenario.customSavingsTarget)} placeholder={language === "ja" ? "Proで設定" : "Set with Pro"} onChange={(event) => updateScenario(scenario.id, { customSavingsTarget: event.target.value === "" ? undefined : Number(event.target.value) })} /><span>{city.currency}</span></div></label>
                </div>
              </article>;
            })}
          </div>
          <button className="oa-add-button" type="button" disabled={!canCreateScenario(activeEntitlements, scenarios.length)} onClick={() => setScenarios((current) => [...current, makeScenario(current.length)])}>＋ {t.add}<small>{scenarios.length}/{activeEntitlements.maxScenarios}</small></button>
          {!canCreateScenario(activeEntitlements, scenarios.length) && activeEntitlements.tier === "free" && <p className="oa-pro-note">{t.scenarioLimit} <Link href="/pricing">{t.upgrade} →</Link></p>}
        </section>

        <section className="oa-section oa-priority-section">
          <div className="oa-section-heading"><div><p className="eyebrow">02 / PRIORITIES</p><h2>{t.priorities}</h2></div><p>{t.prioritiesNote}</p></div>
          {authUser && <div className="oa-profile-defaults">{profileDefaults ? <button className="secondary-button" type="button" onClick={applyProfileDefaults}>{t.applyProfile}</button> : <Link className="inline-link" href="/account">{t.setProfile} →</Link>}</div>}
          <div className="oa-priority-grid">{priorityOrder.map((priority) => <label className="oa-priority" key={priority}><span>{priorityLabels[priority][language]}<strong>{priorities[priority]}/5</strong></span><input type="range" min="0" max="5" step="1" value={priorities[priority]} onChange={(event) => setPriorities((current) => ({ ...current, [priority]: Number(event.target.value) }))} /></label>)}</div>
        </section>

        <section id="result" className="oa-section oa-result-section">
          <div className="oa-decision-banner"><div><p className="eyebrow">03 / DECISION</p><span>{t.bestFit}</span><h2>{cityName(winnerCity, language)}</h2><p>{savingsLead === null ? (language === "ja" ? "現在の優先軸とデータ信頼度を含めて最上位です。" : "It ranks first after your priorities and data confidence are applied.") : language === "ja" ? `2位より年間貯蓄が約${formatMoney(savingsLead, "JPY", language)}多い試算です。` : `Projected annual savings are about ${formatMoney(savingsLead, "JPY", language)} above the runner-up.`}</p></div><div className="oa-decision-score"><strong>{winnerScore.score}</strong><span>/ 100<br />{t.score}</span></div></div>
          <div className="oa-results-grid">{simulation.after.scores.map(renderResultCard)}</div>
        </section>

        <section id="what-if" className="oa-section oa-what-if-section">
          <div className="oa-section-heading"><div><p className="eyebrow">04 / SIMULATE</p><h2>{t.whatIf}</h2></div><p>{t.whatIfNote}</p></div>
          <fieldset className="oa-pro-fieldset" disabled={!activeEntitlements.canUseWhatIf}><div className="oa-what-if-controls">
            <label>{t.target}<select value={activeWhatIfScenario.id} onChange={(event) => setWhatIfScenarioId(event.target.value)}>{scenarios.map((scenario) => <option value={scenario.id} key={scenario.id}>{cityName(cities[scenario.cityId], language)}</option>)}</select></label>
            <label>{t.salaryChange}<div className="input-with-unit"><input type="number" min="-100" max="1000" value={salaryPercent} onChange={(event) => setSalaryPercent(Number(event.target.value))} /><span>%</span></div></label>
            <label>{t.rentChange}<div className="input-with-unit"><input type="number" min="-100" max="1000" value={rentPercent} onChange={(event) => setRentPercent(Number(event.target.value))} /><span>%</span></div></label>
            <label>{t.fxChange}<div className="input-with-unit"><input type="number" min="-99" max="1000" value={exchangePercent} disabled={cities[activeWhatIfScenario.cityId].currency === "JPY"} onChange={(event) => setExchangePercent(Number(event.target.value))} /><span>%</span></div><small>{cities[activeWhatIfScenario.cityId].currency === "JPY" ? t.fxBase : cities[activeWhatIfScenario.cityId].currency}</small></label>
            <label>{t.whatIfHousehold}<select value={whatIfHousehold ?? ""} onChange={(event) => setWhatIfHousehold(event.target.value === "" ? null : event.target.value as ScenarioHousehold)}><option value="">{t.unchanged}</option><option value="single">{t.single}</option><option value="couple">{t.couple}</option></select></label>
            <label>{t.whatIfChildren}<input type="number" min="0" max="10" step="1" placeholder={t.unchanged} value={whatIfChildren ?? ""} onChange={(event) => setWhatIfChildren(event.target.value === "" ? null : Number(event.target.value))} /></label>
            <label>{t.whatIfSpending}<div className="input-with-unit"><input type="number" min="0" placeholder={t.unchanged} value={whatIfSpending ?? ""} onChange={(event) => setWhatIfSpending(event.target.value === "" ? null : Number(event.target.value))} /><span>{activeWhatIfScenario.salaryCurrency}</span></div></label>
            <label>{t.whatIfSavingsTarget}<div className="input-with-unit"><input type="number" min="0" placeholder={t.unchanged} value={whatIfSavingsTarget ?? ""} onChange={(event) => setWhatIfSavingsTarget(event.target.value === "" ? null : Number(event.target.value))} /><span>{activeWhatIfScenario.salaryCurrency}</span></div></label>
            <label>{t.whatIfRetirementAge}<input type="number" min={activeWhatIfScenario.age} max="100" step="1" placeholder={t.unchanged} value={whatIfRetirementAge ?? ""} onChange={(event) => setWhatIfRetirementAge(event.target.value === "" ? null : Number(event.target.value))} /></label>
            <label>{t.whatIfReturnRate}<div className="input-with-unit"><input type="number" min="-50" max="50" step="0.1" placeholder={t.unchanged} value={whatIfReturnRatePercent ?? ""} onChange={(event) => setWhatIfReturnRatePercent(event.target.value === "" ? null : Number(event.target.value))} /><span>%</span></div></label>
          </div>
          <button className="secondary-button" type="button" onClick={() => { setSalaryPercent(0); setRentPercent(0); setExchangePercent(0); setWhatIfHousehold(null); setWhatIfChildren(null); setWhatIfSpending(null); setWhatIfSavingsTarget(null); setWhatIfRetirementAge(null); setWhatIfReturnRatePercent(null); }}>{t.reset}</button>
          <div className="oa-impact-grid">{simulation.deltas.map((delta) => {
            const result = resultById.get(delta.scenarioId) as ScenarioResult;
            const city = cities[result.cityId];
            return <article key={delta.scenarioId} className={delta.scenarioId === activeWhatIfScenario.id ? "is-target" : ""}><span>{cityName(city, language)}</span><div><small>{t.rankChange}</small><strong>{formatSigned(delta.rankChange, (value) => Math.abs(value).toFixed(0))}</strong></div><div><small>{t.scoreChange}</small><strong>{formatSigned(delta.score, (value) => Math.abs(value).toFixed(1))}</strong></div><div><small>{t.savingsChange}</small><strong>{formatSigned(delta.annualSavings, (value) => formatMoney(Math.abs(value), result.currency, language))}</strong></div><div><small>{t.wealthChange}</small><strong>{formatSigned(delta.projectedSavings10Years, (value) => formatMoney(Math.abs(value), result.currency, language))}</strong></div></article>;
          })}</div></fieldset>
          {!activeEntitlements.canUseWhatIf && <p className="oa-pro-note">{t.proRequired} <Link href="/pricing">{t.upgrade} →</Link></p>}
        </section>

        <section id="break-even" className="oa-section oa-break-even-section">
          <div className="oa-section-heading"><div><p className="eyebrow">05 / BREAK-EVEN</p><h2>{t.breakEven}</h2></div><p>{t.breakEvenNote}</p></div>
          {activeEntitlements.canUseBreakEven ? <div className="oa-break-even-grid"><label>{t.candidate}<select value={activeBreakEvenCandidateId} onChange={(event) => setBreakEvenCandidateId(event.target.value)}>{candidateOptions.map((scenario) => <option value={scenario.id} key={scenario.id}>{cityName(cities[scenario.cityId], language)}</option>)}</select></label><label>{t.metric}<select value={breakEvenMetric} onChange={(event) => setBreakEvenMetric(event.target.value as BreakEvenMetric)}><option value="disposableIncome">{t.metricIncome}</option><option value="savingsRate">{t.metricSavings}</option><option value="lifeAtlasScore">{t.metricScore}</option></select></label><div className="oa-break-even-result"><span>{t.requiredSalary}</span><strong>{breakEven?.status === "matched" ? formatMoney(breakEven.requiredAnnualSalary, breakEven.salaryCurrency, language) : "—"}</strong><small>{breakEven?.status === "unreachable" ? t.unreachable : breakEven?.status === "calculation-unavailable" ? t.calculationUnavailable : `${cityName(winnerCity, language)} · ${breakEvenMetric === "disposableIncome" ? t.metricIncome : breakEvenMetric === "savingsRate" ? t.metricSavings : t.metricScore}`}</small></div></div> : <p className="oa-pro-note oa-pro-note-large">{t.proRequired} <Link href="/pricing">{t.upgrade} →</Link></p>}
        </section>

        <section id="save" className="oa-section oa-save-section">
          <div className="oa-section-heading"><div><p className="eyebrow">06 / SAVE</p><h2>{t.saveTitle}</h2></div><p>{t.saveNote}</p></div>
          <div className="oa-save-toolbar">
            <div className="oa-save-status">
              <span>{supabaseConfigured ? t.cloudMode : t.localMode}</span>
              <strong>{authUser ? `${t.signedInAs}: ${authUser.email ?? authUser.id}` : supabaseConfigured ? t.signInRequired : t.localMode}</strong>
            </div>
            <div className="oa-save-actions">
              <button className="primary-button" type="button" onClick={() => void saveCurrentAnalysis()} disabled={historyLoading}>{historyLoading ? t.loading : t.saveAnalysis}</button>
              <button className="secondary-button" type="button" onClick={() => { setHistoryOpen((open) => !open); if (supabaseConfigured && authUser) void loadCloudHistory(); }}>{t.savedAnalyses}</button>
            </div>
          </div>
          {supabaseConfigured && !authUser && <p className="oa-save-signin">{t.signInRequired} <Link href="/#account">{t.signInLink} →</Link></p>}
          {saveMessage && <p className="oa-save-message" role="status" aria-live="polite">{saveMessage}</p>}
          {historyOpen && (
            <div className="oa-saved-list">
              {analyzerHistory.length === 0 ? <p>{t.noSavedAnalyses}</p> : analyzerHistory.map((record) => (
                <article className="oa-saved-item" key={record.id}>
                  <div><strong>{record.title}</strong><small>{new Date(record.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small></div>
                  <div className="oa-saved-item-actions"><button className="secondary-button" type="button" onClick={() => restoreAnalysis(record)}>{t.restore}</button><button className="text-button" type="button" onClick={() => void deleteAnalysis(record)} disabled={historyLoading}>{t.delete}</button></div>
                </article>
              ))}
            </div>
          )}
          <div id="share" className="oa-share-panel">
            <div><strong>{t.shareTitle}</strong><p>{t.shareNote}</p></div>
            {activeEntitlements.canShareResults ? <div className="oa-share-actions"><button className="secondary-button" type="button" onClick={() => void createShare()} disabled={shareLoading || !authUser}>{shareLoading ? t.creatingShare : t.createShare}</button>{shareUrl && <><input aria-label={t.shareTitle} readOnly value={shareUrl} /><button className="text-button" type="button" onClick={() => void copyShare()}>{t.copyShare}</button></>}</div> : <p className="oa-pro-note">{t.proRequired} <Link href="/pricing">{t.upgrade} →</Link></p>}
          </div>
          <div id="download" className="oa-share-panel">
            <div><strong>{t.downloadTitle}</strong><p>{t.downloadNote}</p></div>
            {activeEntitlements.canDownloadResults ? <div className="oa-download-actions"><button className="secondary-button" type="button" onClick={downloadAnalysis}>{t.downloadCsv}</button></div> : <p className="oa-pro-note">{t.proRequired} <Link href="/pricing">{t.upgrade} →</Link></p>}
          </div>
        </section>

        <section id="ai" className="oa-section oa-ai-section" aria-busy={aiLoading}>
          <div className="oa-section-heading"><div><p className="eyebrow">07 / EXPLAIN</p><h2>{t.aiTitle}</h2></div><p>{t.aiNote}</p></div>
          <div className="oa-ai-launch">
            <div><strong>{language === "ja" ? "計算は固定、説明だけAI" : "Fixed calculations, AI explanation only"}</strong><p>{t.aiPrivacy}</p></div>
            <button className="primary-button" type="button" onClick={() => void generateAIRecommendation()} disabled={aiLoading || !authUser}>{aiLoading ? t.generatingAI : t.generateAI}</button>
          </div>
          {!authUser && <p className="oa-save-signin">{t.aiAccountRequired} <Link href="/#account">{t.signInLink} →</Link></p>}
          {aiError && <p className="oa-ai-error" role="status" aria-live="polite">{aiError}</p>}
          {visibleAIGeneration && (
            <div className="oa-ai-result">
              <div className="oa-ai-summary"><span>{visibleAIGeneration.cached ? t.aiCached : t.aiFresh}</span><h3>{visibleAIGeneration.recommendation.executiveSummary}</h3></div>
              <div className="oa-ai-reasons"><h3>{t.aiReasons}</h3>{visibleAIGeneration.recommendation.reasons.map((reason) => <article key={reason.title}><strong>{reason.title}</strong><p>{reason.explanation}</p></article>)}</div>
              <div className="oa-ai-tradeoffs"><h3>{t.aiTradeoffs}</h3>{visibleAIGeneration.recommendation.tradeoffs.map((tradeoff) => {
                const scenario = scenarios.find((item) => item.id === tradeoff.scenarioId);
                const label = scenario ? cityName(cities[scenario.cityId], language) : tradeoff.scenarioId;
                return <article key={tradeoff.scenarioId}><h4>{label}</h4><div><span>{t.advantages}</span><ul>{tradeoff.advantages.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>{t.disadvantages}</span><ul>{tradeoff.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul></div></article>;
              })}</div>
              {visibleAIGeneration.recommendation.risks.length > 0 && <div className="oa-ai-risks"><h3>{t.aiRisks}</h3><ul>{visibleAIGeneration.recommendation.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></div>}
              <div className="oa-ai-followups"><h3>{t.aiNext}</h3><div>{visibleAIGeneration.recommendation.nextQuestions.map((question) => <button type="button" key={question} onClick={() => void generateAIRecommendation(question)} disabled={aiLoading}>{question}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); const question = followUpQuestion.trim(); if (question) void generateAIRecommendation(question); }}><label>{t.followUp}<input value={followUpQuestion} maxLength={400} placeholder={t.followUpPlaceholder} onChange={(event) => setFollowUpQuestion(event.target.value)} /></label><button className="secondary-button" type="submit" disabled={aiLoading || followUpQuestion.trim().length === 0}>{t.askAI}</button></form></div>
              <p className="oa-ai-disclaimer">{t.aiDisclaimer}</p>
            </div>
          )}
        </section>

        <StandardDisclaimer language={language} />
        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">✦</span><strong>Life Atlas</strong><p>The AI decision engine for where to live, work, and build wealth.</p></div><div className="footer-meta"><span>CALCULATION 2026.08-v2.1</span><Link href="/">{t.back}</Link></div></footer>
      </div>
    </main>
  );
}
