"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cities, cityOrder } from "../data/cities";
import { FALLBACK_FX_TO_JPY } from "../data/currencies";
import { trackProductEvent } from "../lib/analytics/client";
import { isComparisonRecord, isSavedAnalyzerInput, LOCAL_HISTORY_LIMIT, localHistoryId, queueAnalyzerRestore, readLocalHistory, writeLocalHistory } from "../lib/comparison-history";
import type { City, CityId, CurrencyCode, DataSource } from "../types/city";
import type { ComparisonRecord as HistoryRecord } from "../types/comparison";
import type { AgeBand, LegacyCityResult, TaxCalculationStatus } from "../types/finance";
import {
  calculateCity,
  householdMultipliers,
  housingMultipliers,
  lifestyleMultipliers,
  officialSalaryBenchmarkSource,
  taxCalculationStatus,
} from "../lib/calculations/legacy-engine";

type SalaryCurrency = "origin" | "JPY";
type DestinationSalaryMode = "localBenchmark" | "sameYen" | "actualOffer";
type Language = "ja" | "en";
type RecommendationPriority = "balance" | "money" | "business";
type RecommendationBusinessCoverage = "detailed" | "reference";
type CityResult = LegacyCityResult<City>;

type OfficialData = {
  sourceStatus: "live" | "partial" | "fallback";
  retrievedAt: string;
  populations: Record<string, { value: number; year: string } | null>;
  exchangeRates: {
    [currency: string]: number | null;
  };
  exchangeObservedOn: string | null;
  coverage: {
    cityCount: number;
    countryCount: number;
    currencyCount: number;
    automaticCountryCount: number;
    automaticCurrencyCount: number;
  };
  sources: Array<{ name: string; scope: string; url: string }>;
  warnings: string[];
};

type SavedComparisonInput = {
  originId: CityId;
  destinationId: CityId;
  salary: string;
  salaryCurrency: SalaryCurrency;
  destinationSalaryMode?: DestinationSalaryMode;
  destinationSalary?: string;
  household: keyof typeof householdMultipliers;
  housing: keyof typeof housingMultipliers;
  lifestyle: keyof typeof lifestyleMultipliers;
  ageBand: AgeBand;
};

const cityEnglishLabels: Partial<Record<CityId, { name: string; country: string; region: string; climate: string; language: string }>> = {
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
const cityPopulationEnglish: Partial<Record<CityId, string>> = {
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
const localizedCityPopulation = (city: City, language: Language) => {
  if (language === "ja") return city.population;
  const translated = cityPopulationEnglish[city.id];
  if (translated) return translated;
  const tenThousands = Number(city.population.match(/([\d,.]+)万人/)?.[1]?.replace(/,/g, ""));
  if (Number.isFinite(tenThousands)) {
    const population = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(tenThousands * 10_000);
    return `Approx. ${population} people (comparison estimate)`;
  }
  return `Population comparison estimate (${englishCityLabel(city).name})`;
};
const cityTimezoneEnglish: Partial<Record<CityId, string>> = {
  tokyo: "UTC+9 (Japan Standard Time)",
  osaka: "UTC+9 (Japan Standard Time)",
  vancouver: "UTC−8 (daylight saving time applies)",
  toronto: "UTC−5 (daylight saving time applies)",
  losAngeles: "UTC−8 (daylight saving time applies)",
  newYork: "UTC−5 (daylight saving time applies)",
  london: "UTC+0 (daylight saving time applies)",
  paris: "UTC+1 (daylight saving time applies)",
  rome: "UTC+1 (daylight saving time applies)",
  queretaro: "UTC−6",
  puebla: "UTC−6",
  merida: "UTC−6",
  mexicoCity: "UTC−6",
  melbourne: "UTC+10 (daylight saving time applies)",
};

const translations = {
  ja: {
    languageSwitch: "English",
    languageAria: "英語表示に切り替える",
    navCompare: "比較する",
    navProfile: "都市プロフィール",
    navMethod: "計算方法",
    themeToLight: "明るくする",
    themeToDark: "暗くする",
    themeAria: "表示テーマを切り替える",
    heroEyebrow: "世界の都市で、暮らしと仕事を設計する",
    heroTitleBefore: "あなたの収入は、",
    heroTitleEmphasis: "どの都市",
    heroTitleAfter: "でより強くなるか。",
    heroText: "海の近く、美しい街で、仕事も人生も育てる。税金・家賃・生活費とビジネス環境を、同じ物差しで比べます。",
    pillCities: "世界50都市 + ビジネス注目10都市",
    pillCurrencies: "現地通貨 + 日本円",
    pillDeductions: "税金・保険料込み",
    compareEyebrow: "01 / 条件をセット",
    compareTitle: "あなたの比較シナリオ",
    salaryNotSaved: "入力した給与は保存されません",
    accountTitle: "登録と比較履歴",
    accountDescription: "登録すると比較条件をオンラインに保存し、あとから呼び出せます。",
    email: "メールアドレス",
    password: "パスワード（8文字以上）",
    register: "新規登録",
    login: "ログイン",
    googleLogin: "Googleで続ける",
    orEmail: "またはメールアドレスで続ける",
    logout: "ログアウト",
    loggedInAs: "ログイン中：",
    saveComparison: "この比較を保存",
    historyTitle: "比較履歴を見る",
    historyEmpty: "まだ保存された比較はありません。",
    historyLocalNote: "Supabase未設定時の確認用として、この端末にのみ保存します。",
    historyCloudNote: "登録後はSupabase（オンライン保存サービス）に保存されます。",
    restore: "呼び出す",
    delete: "削除",
    authSuccess: "処理が完了しました。",
    authRequired: "保存するにはログインしてください。",
    supabaseNotConfigured: "オンライン保存は未設定です。管理者がSupabaseを設定すると利用できます。",
    authError: "認証処理に失敗しました。",
    savedAt: "保存日時",
    localHistoryTitle: "端末内の確認用履歴",
    signupMode: "新規登録はこちら",
    loginMode: "ログインはこちら",
    switchToSignup: "新規登録に切り替える",
    switchToLogin: "ログインに切り替える",
    origin: "出発地",
    destination: "目的地",
    swapAria: "出発地と目的地を入れ替える",
    salary: "年間総支給給与",
    salaryHint: "出発地の現地通貨で入力",
    salaryCurrency: "入力通貨",
    originCurrency: "出発地の現地通貨",
    jpyCurrency: "日本円",
    destinationSalaryMode: "目的地での働き方・給与条件",
    localBenchmarkSalary: "現地就職：公式給与ベンチマーク",
    localBenchmarkHint: "公的統計の給与中央値・平均値がある都市だけ計算します",
    salaryBenchmark: "現地給与ベンチマーク",
    salaryBenchmarkUnavailable: "公式給与ベンチマークなし",
    salaryBenchmarkUnavailableDetail: "公式の給与中央値・平均値を確認できないため、現地就職モードでは手取りと残額を表示しません。",
    sameYenSalary: "リモート勤務：日本の収入を維持",
    sameYenSalaryHint: "現在の給与を円価値のまま為替換算します。現地相場の給与ではありません",
    actualOfferSalary: "実際のオファー年収を入力",
    destinationSalary: "目的地の年間総支給給与",
    destinationSalaryHint: "実際の雇用契約・内定条件を現地通貨で入力",
    household: "世帯",
    housing: "住居",
    lifestyle: "生活スタイル",
    ageBand: "年齢区分（保険料）",
    ageHint: "日本の介護保険料に反映",
    compare: "比較結果を見る",
    reset: "条件を初期化",
    assumption: "既定は現地就職で、公的統計の給与ベンチマークを使います。リモート勤務は日本の収入を維持、内定後は実際のオファー年収へ切り替えてください。給与または税制度を公式資料で確認できない都市は手取り・残額を表示しません。",
    resultEyebrow: "02 / 結果のサマリー",
    resultTitle: "毎月、どれくらい残る？",
    dataLoading: "公的データを確認中…",
    dataLive: "選択通貨の為替をECBから取得",
    dataPartial: "一部は保存した参考値",
    update: "公式データを更新",
    updating: "更新中",
    fallback: "自動取得できない項目は保存した参考値を表示しています。",
    dataCoverageTitle: "現在のデータ範囲",
    dataCoverageSummary: "50都市・23通貨を対象に、項目ごとの基準日と更新方法を表示",
    automatic: "自動取得",
    baseCurrency: "基準通貨",
    officialSnapshot: "公式統計の保存値",
    estimateValue: "比較用推定",
    referenceValue: "保存した参考値",
    cityPopulationBaseline: "都市人口の基準値",
    countryPopulationReference: "国人口（自動取得・参考情報）",
    countryPopulationUnavailable: "国人口の自動取得対象外",
    exchangeRateLabel: "日本円への換算レート",
    jpyBaseCurrency: "日本円は換算不要の基準通貨",
    baselineDateUnknown: "基準日不明",
    retrievedLabel: "API確認時刻",
    sourceLabelText: "出典",
    scopeLabelText: "対象範囲",
    monthly: " / 月",
    yenValue: "日本円では",
    takeHome: "手取り月収",
    taxesInsurance: "税金・保険料",
    monthlySpend: "月間支出",
    rentBurden: "家賃負担率",
    deductionHeading: "税金・保険料の内訳（月）",
    incomeTax: "所得税",
    federalProvincialTax: "連邦・州所得税",
    federalStateCityTax: "連邦・州・市所得税",
    reconstructionTax: "復興特別所得税",
    residentTax: "住民税",
    healthInsurance: "健康保険",
    pension: "厚生年金",
    employmentInsurance: "雇用保険",
    careInsurance: "介護保険",
    childSupport: "子ども・子育て支援金",
    localTax: "州・地方税",
    employerHealth: "雇用主医療保険（推定）",
    medicalSocial: "医療・社会保険",
    imssHealth: "IMSS医療保険（推定）",
    socialSecurity: "Social Security",
    cppPension: "CPP年金",
    inpsPension: "INPS年金",
    retirementFund: "退職積立",
    pensionInsurance: "年金保険",
    retirement: "年金・退職保険",
    unemployment: "失業保険等",
    medicare: "Medicare給与税",
    employerSuper: "雇用主の退職積立（手取り外）",
    deductionTotal: "手取りから引かれる合計",
    calculationOfficial: "公式制度・対象者確認済み",
    calculationEstimate: "公式税率ベースの簡易試算",
    calculationUnavailable: "公式計算未対応",
    calculationUnavailableDetail: "税金・社会保険を公式制度で確認できていないため、手取りと残額を表示していません。家賃・生活費は保存した参考シナリオです。",
    currentScenario: "現在地の試算",
    localBenchmarkScenario: "現地の公式給与ベンチマークで試算",
    sameYenScenario: "日本の収入を維持するリモート勤務で試算",
    actualOfferScenario: "入力した現地オファー給与で試算",
    calloutNote: "住居・生活スタイル・世帯人数を変えると結果も変わります。数字は判断の出発点としてご利用ください。",
    costEyebrow: "03 / 月間コスト",
    costTitle: "生活費の内訳",
    localCurrency: "現地通貨 / 日本円",
    rent: "家賃",
    food: "食費",
    utilities: "光熱費",
    internet: "通信費",
    transport: "交通費",
    medical: "医療費",
    leisure: "娯楽費",
    yenFootnote: "日本円換算は比較用の表示です。実際の計算は各都市の現地通貨で行っています。",
    assetEyebrow: "04 / 資産形成",
    assetTitle: "貯める力の比較",
    annualSavings: "年間貯蓄可能額",
    costIndex: "生活コスト指数",
    purchasingPower: "購買力指数",
    fireNote: "FIREの簡易目安",
    fireTitle: "年間生活費の25倍を目標資産として試算",
    fireDescription: "投資収益や現在資産は含まない、標準ケースの目安です。",
    profileEyebrow: "05 / 都市プロフィール",
    profileTitle: "都市の暮らしを知る",
    profileNote: "お金以外の違いも一緒に確認",
    population: "人口",
    timezone: "時差",
    climate: "気候",
    officialLanguage: "公用語",
    japaneseFood: "日本食",
    englishLiving: "英語生活",
    internetScore: "通信",
    transitScore: "交通",
    dataCoverage: "データ範囲：",
    scoreEyebrow: "06 / 7つのスコア",
    scoreTitle: "目的によって、都市の見え方は変わる",
    scoreNote: "100点満点・デモ計算",
    scoreFootnote: "スコアは入力条件、都市データ、計算方法の版に基づく比較用の目安です。移住や投資の決定を自動で行うものではありません。",
    businessTitle: "ビジネスを見る",
    businessText: "起業しやすさ、法人税、日本車需要、中古車市場、ノマド適性を都市ごとに整理します。",
    transparencyTitle: "データの透明性",
    transparencyText: "公式値・計算値・推定値を区別し、データの対象期間と取得日時を表示します。",
    moreDetails: "詳細を見る",
    sourcesNotes: "出典と注意事項",
    methodEyebrow: "07 / 計算方法",
    methodTitle: "この結果の前提",
    close: "閉じる",
    dataStatus: "データ状態",
    dataLiveMethod: "国人口・対応通貨の為替を自動取得",
    dataFallbackMethod: "自動取得値と保存した参考値を区別",
    retrievedAt: "取得時刻：",
    cityCosts: "都市別の家賃・給与",
    cityCostsStrong: "公式統計の範囲を明示",
    cityCostsText: "給与は都道府県・州・国、物価は都市のCPIなど、実際に公表されている地域の範囲を明示します。広告や民間ランキングを公式値として扱いません。",
    taxes: "税金・保険料",
    taxesStrong: "計算対象と未対応を分離",
    taxesText: "シンガポールは長期就労する外国人税務居住者としてIRAS累進税率・CPFなし、UAEは外国人被用者として個人所得税・公的年金控除なしで計算します。既存国は公式税率ベースの簡易試算として表示し、未実装の国・州は金額を表示しません。",
    formula: "毎月残る金額・FIRE目安",
    formulaStrong: "手取り − 家賃 − 生活費 / 年間生活費 × 25",
    formulaText: "公式税率を使いますが、各国の扶養、控除、賞与、標準報酬、医療保険プランなどをすべて再現する給与明細ではありません。比較の出発点としてご利用ください。",
    autoSources: "自動取得元",
    citySources: "都市別に参照している公式資料",
    footerText: "収入と都市の距離を、もっと分かりやすく。",
    footerCities: "世界50都市対応",
    footerDeductions: "税金・保険料込み",
    householdSingle: "単身成人",
    householdCouple: "大人2人",
    householdSingleParent: "ひとり親 + 子ども1人",
    householdOneChild: "大人2人 + 子ども1人",
    householdTwoChildren: "大人2人 + 子ども2人",
    householdThreeChildren: "大人2人 + 子ども3人",
    housingShared: "シェア・個室",
    housingStudio: "ワンルーム・スタジオ",
    housingOnebed: "アパート・1ベッドルーム",
    housingCondo: "マンション・分譲タイプ",
    housingTwobed: "2ベッドルーム",
    housingHouse: "一戸建て",
    lifestyleLean: "節約型",
    lifestyleBalanced: "標準型",
    lifestyleComfortable: "ゆとり型",
    ageUnder40: "40歳未満",
    age40to64: "40〜64歳",
    age65plus: "65歳以上",
  },
  en: {
    languageSwitch: "日本語",
    languageAria: "Switch to Japanese",
    navCompare: "Compare",
    navProfile: "City profiles",
    navMethod: "Method",
    themeToLight: "Light mode",
    themeToDark: "Dark mode",
    themeAria: "Switch color theme",
    heroEyebrow: "Design your life and work across world cities",
    heroTitleBefore: "Where does your income ",
    heroTitleEmphasis: "go further",
    heroTitleAfter: "?",
    heroText: "Build a life and a business near the sea, in a city you love. Compare taxes, rent, living costs and founder readiness on one clear map.",
    pillCities: "50 cities + 10 business spotlights",
    pillCurrencies: "Local currency + JPY",
    pillDeductions: "Taxes and insurance included",
    compareEyebrow: "01 / SET YOUR CONDITIONS",
    compareTitle: "Your comparison scenario",
    salaryNotSaved: "Your salary input is not saved",
    accountTitle: "Account and comparison history",
    accountDescription: "Create an account to save your comparison conditions online and restore them later.",
    email: "Email address",
    password: "Password (8+ characters)",
    register: "Create account",
    login: "Log in",
    googleLogin: "Continue with Google",
    orEmail: "or continue with email",
    logout: "Log out",
    loggedInAs: "Logged in as: ",
    saveComparison: "Save this comparison",
    historyTitle: "View comparison history",
    historyEmpty: "No saved comparisons yet.",
    historyLocalNote: "For preview only, this saves on this device when Supabase is not configured.",
    historyCloudNote: "After registration, history is saved in Supabase (online storage).",
    restore: "Restore",
    delete: "Delete",
    authSuccess: "Done.",
    authRequired: "Please log in to save a comparison.",
    supabaseNotConfigured: "Online saving is not configured yet. An administrator must connect Supabase.",
    authError: "Authentication failed.",
    savedAt: "Saved",
    localHistoryTitle: "Preview history on this device",
    signupMode: "Create an account",
    loginMode: "Log in here",
    switchToSignup: "Switch to account creation",
    switchToLogin: "Switch to login",
    origin: "Origin",
    destination: "Destination",
    swapAria: "Swap origin and destination",
    salary: "Annual gross salary",
    salaryHint: "Enter it in the origin city's currency",
    salaryCurrency: "Input currency",
    originCurrency: "Origin city currency",
    jpyCurrency: "Japanese yen",
    destinationSalaryMode: "Work and salary scenario at destination",
    localBenchmarkSalary: "Local employment: official salary benchmark",
    localBenchmarkHint: "Calculated only where a public median or mean salary benchmark is available",
    salaryBenchmark: "Local salary benchmark",
    salaryBenchmarkUnavailable: "No official salary benchmark",
    salaryBenchmarkUnavailableDetail: "Take-home and money left are hidden in local-employment mode because no official median or mean salary benchmark has been verified.",
    sameYenSalary: "Remote work: keep Japanese income",
    sameYenSalaryHint: "Converts the current income by FX only; this is not a local-market salary",
    actualOfferSalary: "Enter an actual salary offer",
    destinationSalary: "Destination annual gross salary",
    destinationSalaryHint: "Enter the employment offer in the destination currency",
    household: "Household",
    housing: "Housing",
    lifestyle: "Lifestyle",
    ageBand: "Age band (insurance)",
    ageHint: "Applied to Japan's long-term care insurance",
    compare: "See comparison",
    reset: "Reset conditions",
    assumption: "The default is local employment using a public salary benchmark. Choose remote work to keep Japanese income, or enter the actual offer after receiving one. Take-home and money-left figures are hidden when salary or tax rules cannot be verified from public sources.",
    resultEyebrow: "02 / SUMMARY",
    resultTitle: "How much remains each month?",
    dataLoading: "Checking public data…",
    dataLive: "Selected FX rates retrieved from the ECB",
    dataPartial: "Some fields use saved reference values",
    update: "Refresh public data",
    updating: "Updating",
    fallback: "Fields unavailable from an automatic source use saved reference values.",
    dataCoverageTitle: "Current data coverage",
    dataCoverageSummary: "Covers 50 cities and 23 currencies, with the date and update method shown for each field",
    automatic: "Automatic",
    baseCurrency: "Base currency",
    officialSnapshot: "Saved official statistic",
    estimateValue: "Comparison estimate",
    referenceValue: "Saved reference value",
    cityPopulationBaseline: "City population baseline",
    countryPopulationReference: "Country population (automatic context)",
    countryPopulationUnavailable: "Automatic country population unavailable",
    exchangeRateLabel: "Conversion rate to JPY",
    jpyBaseCurrency: "JPY is the base currency; no conversion is required",
    baselineDateUnknown: "Baseline date unavailable",
    retrievedLabel: "API checked",
    sourceLabelText: "Source",
    scopeLabelText: "Coverage",
    monthly: " / month",
    yenValue: "In Japanese yen",
    takeHome: "Monthly take-home",
    taxesInsurance: "Taxes and insurance",
    monthlySpend: "Monthly spending",
    rentBurden: "Rent burden",
    deductionHeading: "Monthly taxes and insurance",
    incomeTax: "Income tax",
    federalProvincialTax: "Federal and provincial tax",
    federalStateCityTax: "Federal, state and city tax",
    reconstructionTax: "Reconstruction surtax",
    residentTax: "Resident tax",
    healthInsurance: "Health insurance",
    pension: "Employee pension",
    employmentInsurance: "Employment insurance",
    careInsurance: "Long-term care insurance",
    childSupport: "Child and childcare support",
    localTax: "State or local tax",
    employerHealth: "Employer health insurance (estimate)",
    medicalSocial: "Medical and social insurance",
    imssHealth: "IMSS health insurance (estimate)",
    socialSecurity: "Social Security",
    cppPension: "CPP pension",
    inpsPension: "INPS pension",
    retirementFund: "Retirement fund",
    pensionInsurance: "Pension insurance",
    retirement: "Pension / retirement insurance",
    unemployment: "Unemployment insurance etc.",
    medicare: "Medicare levy",
    employerSuper: "Employer superannuation (outside take-home)",
    deductionTotal: "Total deducted from take-home",
    calculationOfficial: "Official rules and worker scope verified",
    calculationEstimate: "Simplified estimate using official rates",
    calculationUnavailable: "Official calculation unavailable",
    calculationUnavailableDetail: "Take-home and money left are hidden because tax and social-insurance rules have not been verified for this worker scenario. Rent and living costs remain saved reference scenarios.",
    currentScenario: "Origin scenario",
    localBenchmarkScenario: "Official local salary benchmark",
    sameYenScenario: "Remote work retaining Japanese income",
    actualOfferScenario: "Actual destination salary entered",
    calloutNote: "Results change with housing, lifestyle and household size. Use these numbers as a starting point for decisions.",
    costEyebrow: "03 / MONTHLY COSTS",
    costTitle: "Living-cost breakdown",
    localCurrency: "Local currency / JPY",
    rent: "Rent",
    food: "Food",
    utilities: "Utilities",
    internet: "Internet",
    transport: "Transport",
    medical: "Medical",
    leisure: "Leisure",
    yenFootnote: "JPY values are shown for comparison. Calculations are performed in each city's local currency.",
    assetEyebrow: "04 / WEALTH BUILDING",
    assetTitle: "Savings power compared",
    annualSavings: "Potential annual savings",
    costIndex: "Living-cost index",
    purchasingPower: "Purchasing-power index",
    fireNote: "Simple FIRE estimate",
    fireTitle: "Target assets estimated at 25× annual living costs",
    fireDescription: "A standard-case reference; investment returns and current assets are not included.",
    profileEyebrow: "05 / CITY PROFILE",
    profileTitle: "Understand daily life in each city",
    profileNote: "Review non-financial differences too",
    population: "Population",
    timezone: "Time zone",
    climate: "Climate",
    officialLanguage: "Official language",
    japaneseFood: "Japanese food",
    englishLiving: "English-only living",
    internetScore: "Internet",
    transitScore: "Transit",
    dataCoverage: "Data coverage: ",
    scoreEyebrow: "06 / SEVEN SCORES",
    scoreTitle: "A city's fit changes with your goal",
    scoreNote: "Out of 100 · comparison estimate",
    scoreFootnote: "Scores are comparison estimates based on the inputs, city data and calculation version. They do not make relocation or investment decisions automatically.",
    businessTitle: "Business view",
    businessText: "Organizes entrepreneurship, corporate tax, Japanese-car demand, used-car fit and nomad suitability by city.",
    transparencyTitle: "Data transparency",
    transparencyText: "Separates official, calculated and estimated values, and shows the data period and retrieval time.",
    moreDetails: "View details",
    sourcesNotes: "Sources and notes",
    methodEyebrow: "07 / METHOD",
    methodTitle: "Assumptions behind this result",
    close: "Close",
    dataStatus: "Data status",
    dataLiveMethod: "Country population and supported FX rates retrieved automatically",
    dataFallbackMethod: "Automatic values and saved references are clearly separated",
    retrievedAt: "Retrieved: ",
    cityCosts: "City rent and salary",
    cityCostsStrong: "Public-data coverage is shown",
    cityCostsText: "Salary data is shown at the prefecture, state or national level, while prices use published city or CPI data where available. Advertising and private rankings are not presented as official values.",
    taxes: "Taxes and insurance",
    taxesStrong: "Calculated and unavailable coverage are separated",
    taxesText: "Singapore uses IRAS progressive resident rates with no CPF for a foreign employee. The UAE uses no individual income tax or expatriate public-pension deduction. Existing supported countries are labelled as simplified official-rate estimates; unimplemented countries, states and provinces do not show financial results.",
    formula: "Monthly remainder and FIRE estimate",
    formulaStrong: "Take-home − rent − living costs / annual living costs × 25",
    formulaText: "Official tax rates are used, but this is not a payslip that fully reproduces every country's dependents, deductions, bonuses, payroll bases or health-plan choices.",
    autoSources: "Automatic sources",
    citySources: "Official sources referenced by city",
    footerText: "Make the distance between income and cities easier to understand.",
    footerCities: "50 cities worldwide",
    footerDeductions: "Taxes and insurance included",
    householdSingle: "Single adult",
    householdCouple: "Two adults",
    householdSingleParent: "Single parent + 1 child",
    householdOneChild: "Two adults + 1 child",
    householdTwoChildren: "Two adults + 2 children",
    householdThreeChildren: "Two adults + 3 children",
    housingShared: "Shared / private room",
    housingStudio: "Studio",
    housingOnebed: "Apartment / 1-bedroom",
    housingCondo: "Condominium",
    housingTwobed: "2-bedroom",
    housingHouse: "Detached house",
    lifestyleLean: "Lean",
    lifestyleBalanced: "Balanced",
    lifestyleComfortable: "Comfortable",
    ageUnder40: "Under 40",
    age40to64: "40–64",
    age65plus: "65+",
  },
} as const;

const englishCityLabel = (city: City) => cityEnglishLabels[city.id] ?? { name: city.englishName ?? city.name, country: city.englishCountry ?? city.country, region: city.englishRegion ?? city.region, climate: city.englishClimate ?? city.climate, language: city.englishLanguage ?? city.language };
const cityName = (city: City, language: Language) => language === "ja" ? city.name : englishCityLabel(city).name;
const cityCountry = (city: City, language: Language) => language === "ja" ? city.country : englishCityLabel(city).country;
const cityRegion = (city: City, language: Language) => language === "ja" ? city.region : englishCityLabel(city).region;
const cityClimate = (city: City, language: Language) => language === "ja" ? city.climate : englishCityLabel(city).climate;
const cityLanguage = (city: City, language: Language) => language === "ja" ? city.language : englishCityLabel(city).language;
const sourceItem = (item: string, language: Language) => {
  if (language === "ja") return item;
  const labels: Record<string, string> = { "人口": "Population", "人口・物価・給与・家賃": "Population, prices, salary and rent", "物価": "Prices", "物価・家賃": "Prices and rent", "給与": "Salary", "給与中央値": "Median salary", "所得税": "Income tax", "連邦・州所得税": "Federal and provincial tax", "連邦所得税": "Federal income tax", "州税・市税": "State and city tax", "社会保障・Medicare": "Social Security and Medicare", "医療保険": "Health insurance", "健康保険・介護保険": "Health and long-term care insurance", "CPP・EI": "CPP and EI", "国民保険": "National Insurance", "社会保険": "Social insurance", "年金": "Pension", "退職積立": "Superannuation", "所得税・Medicare levy": "Income tax and Medicare levy" };
  return labels[item] ?? item;
};
const sourceLevel = (level: DataSource["level"], language: Language) => {
  if (language === "ja") return level;
  const labels: Record<DataSource["level"], string> = { 都市: "City", 都道府県: "Prefecture", 州: "State", 国: "Country", "国・州": "Country / state", "州・市": "State / city", 都市圏: "Metro area", 自治体: "Municipality" };
  return labels[level];
};
const sourceScope = (scope: string, language: Language) => {
  if (language === "ja") return scope;
  const labels: Record<string, string> = { "各国の人口": "Population by country", "各通貨を日本円へ換算するための為替": "FX rates used to convert currencies to JPY", "対象国の総人口（都市人口ではありません）": "Country population only (not city population)", "対応通貨を日本円へ換算するための日次為替": "Daily rates for supported currencies converted to JPY" };
  return labels[scope] ?? scope;
};
const sourcePeriod = (period: string, language: Language) => {
  if (language === "ja") return period;
  const labels: Record<string, string> = {
    "2025年10月1日速報": "Preliminary 1 October 2025",
    "2026年7月1日": "1 July 2026",
    "2021年国勢調査": "2021 Census",
    "2023年推計": "2023 estimate",
    "2024年推計": "2024 estimate",
    "2023年": "2023",
    "2024年": "2024",
    "2020年国勢調査": "2020 Census",
    "2024-25年度・2025年6月30日": "2024–25 reporting year · 30 June 2025",
    "2026年時点の比較用推定": "2026 comparison estimate",
  };
  return labels[period] ?? period.replace(/年/g, "");
};

const formatMoney = (value: number, currency: CurrencyCode, language: Language = "ja") =>
  new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const formatYen = (value: number, language: Language = "ja") => formatMoney(value, "JPY", language);

const formatPopulation = (value: number, period: string, scope: string, language: Language = "ja") => language === "ja"
  ? `約${new Intl.NumberFormat("ja-JP").format(Math.round(value / 10_000))}万人（${scope}・${period}）`
  : `Approx. ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)} people (${scope} · ${period})`;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const scoreRows = [
  ["住みやすさ", "Livability", "livability"],
  ["貯金しやすさ", "Savings", "savings"],
  ["起業向き", "Business", "business"],
  ["FIRE向き", "FIRE", "fire"],
  ["ノマド向き", "Nomad", "nomad"],
  ["家族向き", "Family", "family"],
  ["総合評価", "Overall", "overall"],
] as const;

type LocalizedText = { ja: string; en: string };

type GlobalBusinessProfile = {
  cityId: CityId;
  city: LocalizedText;
  country: LocalizedText;
  score: number;
  digital: number;
  tax: LocalizedText;
  setup: LocalizedText;
  fit: LocalizedText;
  watch: LocalizedText;
  source: string;
  url: string;
};

const globalBusinessProfiles: GlobalBusinessProfile[] = [
  { cityId: "singapore", city: { ja: "シンガポール", en: "Singapore" }, country: { ja: "シンガポール", en: "Singapore" }, score: 95, digital: 98, tax: { ja: "法人税 17%", en: "17% corporate tax" }, setup: { ja: "Bizfileで電子手続き。外国法人は現地代表者が必要", en: "Digital filing via Bizfile; foreign branches need a local representative" }, fit: { ja: "アジア統括、SaaS、金融、貿易", en: "Asia HQ, SaaS, finance and trade" }, watch: { ja: "現地役員・会社秘書、人件費と不動産コスト", en: "Local officers, company secretary and high operating costs" }, source: "ACRA / IRAS", url: "https://www.acra.gov.sg/register/foreign-business/" },
  { cityId: "hongKong", city: { ja: "香港", en: "Hong Kong" }, country: { ja: "香港", en: "Hong Kong" }, score: 93, digital: 96, tax: { ja: "利得税 8.25% / 16.5%", en: "8.25% / 16.5% profits tax" }, setup: { ja: "電子申請の現地法人は通常1時間以内に証明書発行", en: "Electronic certificates for local companies are normally issued within one hour" }, fit: { ja: "貿易、金融、中国市場へのゲートウェイ", en: "Trade, finance and access to Greater China" }, watch: { ja: "会社登録と事業登録は別制度。銀行口座は別審査", en: "Company and business registration differ; banking is a separate review" }, source: "Companies Registry / GovHK", url: "https://www.cr.gov.hk/en/services/register-company.htm" },
  { cityId: "dubai", city: { ja: "ドバイ", en: "Dubai" }, country: { ja: "UAE", en: "UAE" }, score: 91, digital: 94, tax: { ja: "法人税の標準税率 9%", en: "9% standard corporate tax" }, setup: { ja: "MainlandとFree Zoneから選択。多くの業種で100%外資所有", en: "Choose mainland or a free zone; 100% foreign ownership in many activities" }, fit: { ja: "MENA拠点、貿易、コンサル、デジタル事業", en: "MENA hub, trade, consulting and digital businesses" }, watch: { ja: "ライセンス種類と営業地域、オフィス・ビザ費用", en: "Licence scope, trading territory, office and visa costs" }, source: "Invest in Dubai / OECD", url: "https://www.investindubai.gov.ae/en/business-setup" },
  { cityId: "london", city: { ja: "ロンドン", en: "London" }, country: { ja: "イギリス", en: "United Kingdom" }, score: 90, digital: 93, tax: { ja: "法人税 19%〜25%", en: "19% to 25% corporation tax" }, setup: { ja: "Companies Houseでオンライン設立。通常24時間以内", en: "Online incorporation through Companies House, normally within 24 hours" }, fit: { ja: "金融、クリエイティブ、SaaS、プロフェッショナル", en: "Finance, creative industries, SaaS and professional services" }, watch: { ja: "本人確認、銀行・移民手続き、高い固定費", en: "Identity checks, banking, immigration and high fixed costs" }, source: "Companies House / HMRC", url: "https://www.gov.uk/limited-company-formation" },
  { cityId: "dublin", city: { ja: "ダブリン", en: "Dublin" }, country: { ja: "アイルランド", en: "Ireland" }, score: 88, digital: 91, tax: { ja: "事業所得の法人税 12.5%", en: "12.5% corporation tax on trading income" }, setup: { ja: "CROのCOREから電子申請。EU市場と英語環境", en: "Electronic filing through CRO CORE with EU market access" }, fit: { ja: "SaaS、フィンテック、EU本部、コンテンツ", en: "SaaS, fintech, EU headquarters and content" }, watch: { ja: "EEA居住取締役の要件または代替措置、住居費", en: "EEA-resident director rule or alternatives, plus housing costs" }, source: "CRO / Revenue", url: "https://cro.ie/Registration/Company/Registration-Methods/" },
  { cityId: "seoul", city: { ja: "ソウル", en: "Seoul" }, country: { ja: "韓国", en: "South Korea" }, score: 87, digital: 94, tax: { ja: "税率は所得階層・地方税で変動", en: "Rates vary by profit band and local surtax" }, setup: { ja: "外国投資届出から登録まで公式目安は約2週間", en: "Official guidance estimates about two weeks for the foreign-invested company process" }, fit: { ja: "AI、ゲーム、コンテンツ、消費者テック", en: "AI, gaming, content and consumer technology" }, watch: { ja: "FDI認定の投資要件、韓国語契約、銀行手続き", en: "FDI thresholds, Korean contracts and banking procedures" }, source: "Invest KOREA", url: "https://www.investkorea.org/ik-en/cntnts/i-351/web.do" },
  { cityId: "vancouver", city: { ja: "バンクーバー", en: "Vancouver" }, country: { ja: "カナダ", en: "Canada" }, score: 86, digital: 90, tax: { ja: "一般法人税 連邦15% + BC州12%", en: "15% federal + 12% BC general corporate tax" }, setup: { ja: "連邦法人はオンライン設立。BC州登録と税番号も確認", en: "Federal online incorporation, plus BC registration and tax accounts" }, fit: { ja: "クリーンテック、ゲーム、映像、北米・アジア貿易", en: "Cleantech, gaming, film and Pacific trade" }, watch: { ja: "連邦・州・市の三層手続き、住居費、就労資格", en: "Federal, provincial and city rules, housing and work status" }, source: "Corporations Canada / CRA", url: "https://ised-isde.canada.ca/site/corporations-canada/en/business-corporations/how-incorporate-business" },
  { cityId: "melbourne", city: { ja: "メルボルン", en: "Melbourne" }, country: { ja: "オーストラリア", en: "Australia" }, score: 85, digital: 91, tax: { ja: "法人税 25%または30%", en: "25% or 30% company tax" }, setup: { ja: "外国会社はASIC登録、現地代理人、ARBNが必要", en: "Foreign companies need ASIC registration, a local agent and an ARBN" }, fit: { ja: "医療、教育、デザイン、気候テック", en: "Health, education, design and climate technology" }, watch: { ja: "現地代理人、取締役ID、州別の雇用・許認可", en: "Local agent, director ID and state employment or licensing rules" }, source: "ASIC / business.gov.au", url: "https://www.asic.gov.au/for-business-and-companies/foreign-companies/register-a-foreign-company-in-australia/" },
  { cityId: "lisbon", city: { ja: "リスボン", en: "Lisbon" }, country: { ja: "ポルトガル", en: "Portugal" }, score: 84, digital: 89, tax: { ja: "2026年のIRC標準税率 19%", en: "19% standard IRC rate in 2026" }, setup: { ja: "Empresa Online 2.0で電子設立。外国人はNIFと対応電子IDが鍵", en: "Digital incorporation via Empresa Online 2.0; foreigners need a NIF and supported e-ID" }, fit: { ja: "SaaS、リモートチーム、観光テック、EU展開", en: "SaaS, remote teams, travel tech and EU expansion" }, watch: { ja: "NIF、電子署名、社会保障、自治体手続き", en: "NIF, digital signature, social security and municipal steps" }, source: "gov.pt / Justiça", url: "https://registo.justica.gov.pt/empresa" },
  { cityId: "taipei", city: { ja: "台北", en: "Taipei" }, country: { ja: "台湾", en: "Taiwan" }, score: 83, digital: 90, tax: { ja: "法人所得税は原則20%", en: "Corporate income tax is generally 20%" }, setup: { ja: "名称予査、外国投資審査、登録、税籍の順", en: "Name reservation, foreign-investment review, registration and tax registration" }, fit: { ja: "半導体、ハードウェア、越境EC、デザイン", en: "Semiconductors, hardware, cross-border commerce and design" }, watch: { ja: "中文社名、投資審査、業種別許可、居留資格", en: "Chinese company name, investment review, sector permits and residency" }, source: "Invest Taiwan", url: "https://investtaiwan.nat.gov.tw/showPage?lang=eng&menuNum=7&search=InvestmentStatus" },
];

const globalBusinessProfilesByCity = new Map(globalBusinessProfiles.map((profile) => [profile.cityId, profile]));
const REFERENCE_BUSINESS_CONFIDENCE = 0.5;

const recommendationWeights: Record<RecommendationPriority, { money: number; business: number; livability: number }> = {
  balance: { money: 0.4, business: 0.35, livability: 0.25 },
  money: { money: 0.6, business: 0.2, livability: 0.2 },
  business: { money: 0.2, business: 0.6, livability: 0.2 },
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("ja");
  const [originId, setOriginId] = useState<CityId>("tokyo");
  const [destinationId, setDestinationId] = useState<CityId>("singapore");
  const [salary, setSalary] = useState("8500000");
  const [salaryCurrency, setSalaryCurrency] = useState<SalaryCurrency>("origin");
  const [destinationSalaryMode, setDestinationSalaryMode] = useState<DestinationSalaryMode>("localBenchmark");
  const [destinationSalary, setDestinationSalary] = useState("");
  const [household, setHousehold] = useState<keyof typeof householdMultipliers>("single");
  const [housing, setHousing] = useState<keyof typeof housingMultipliers>("onebed");
  const [lifestyle, setLifestyle] = useState<keyof typeof lifestyleMultipliers>("balanced");
  const [ageBand, setAgeBand] = useState<AgeBand>("under40");
  const [recommendationPriority, setRecommendationPriority] = useState<RecommendationPriority>("balance");
  const [darkMode, setDarkMode] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [officialData, setOfficialData] = useState<OfficialData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUser, setAuthUser] = useState<{ id: string; email?: string } | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);
  const t = translations[language];
  const displayCityName = (city: City) => cityName(city, language);
  const displayCityCountry = (city: City) => cityCountry(city, language);
  const displayCityRegion = (city: City) => cityRegion(city, language);
  const displayCityClimate = (city: City) => cityClimate(city, language);
  const displayCityLanguage = (city: City) => cityLanguage(city, language);
  const money = (value: number, currency: CurrencyCode) => formatMoney(value, currency, language);
  const yen = (value: number) => formatYen(value, language);
  const dualMoney = (value: number, currency: CurrencyCode, rateToJpy: number) => `${money(value, currency)} / ${yen(value * rateToJpy)}`;
  const optionalMoney = (value: number | null, currency: CurrencyCode) => value === null ? "—" : money(value, currency);
  const optionalYen = (value: number | null) => value === null ? "—" : yen(value);
  const optionalDualMoney = (value: number | null, currency: CurrencyCode, rateToJpy: number) => value === null ? "—" : dualMoney(value, currency, rateToJpy);
  const calculationLabel = (status: TaxCalculationStatus) => status === "official-scenario" ? t.calculationOfficial : status === "official-rate-estimate" ? t.calculationEstimate : t.calculationUnavailable;
  const unavailableTitle = (result: CityResult) => result.calculationUnavailableReason === "salary" ? t.salaryBenchmarkUnavailable : t.calculationUnavailable;
  const unavailableDetail = (result: CityResult) => result.calculationUnavailableReason === "salary" ? t.salaryBenchmarkUnavailableDetail : t.calculationUnavailableDetail;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const loadCloudHistory = useCallback(async () => {
    if (!supabaseConfigured) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setHistory(Array.isArray(data.history) ? data.history.filter(isComparisonRecord).slice(0, LOCAL_HISTORY_LIMIT) : []);
      else if (response.status === 503 && data.configured === false) {
        setAuthUser(null);
        setSupabaseConfigured(false);
        setAuthMessage(t.historyLocalNote);
      }
      else if (response.status !== 401) setAuthMessage(data.error ?? t.authError);
    } catch {
      setAuthMessage(t.authError);
    } finally {
      setHistoryLoading(false);
    }
  }, [supabaseConfigured, t.authError, t.historyLocalNote]);

  useEffect(() => {
    if (!supabaseConfigured) {
      let active = true;
      const syncLocalHistory = () => setHistory(readLocalHistory());
      void Promise.resolve(readLocalHistory()).then((saved) => {
        if (active) setHistory(saved);
      });
      window.addEventListener("storage", syncLocalHistory);
      return () => {
        active = false;
        window.removeEventListener("storage", syncLocalHistory);
      };
    }

    void fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (response.status === 503 && data?.configured === false) {
          setAuthUser(null);
          setSupabaseConfigured(false);
          return;
        }
        if (data?.user) {
          setAuthUser(data.user);
          void loadCloudHistory();
        }
      })
      .catch(() => undefined);
  }, [loadCloudHistory, supabaseConfigured]);

  const refreshOfficialData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const response = await fetch("/api/data-refresh", { cache: "no-store" });
      if (!response.ok) throw new Error(language === "ja" ? "公式データを取得できませんでした。" : "Could not retrieve public data.");
      setOfficialData((await response.json()) as OfficialData);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : language === "ja" ? "公式データを取得できませんでした。" : "Could not retrieve public data.");
    } finally {
      setDataLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void Promise.resolve().then(() => refreshOfficialData());
  }, [refreshOfficialData]);

  const originBase = cities[originId];
  const destinationBase = cities[destinationId];
  const fxToJpy = useCallback((currency: CurrencyCode) => currency === "JPY" ? 1 : (officialData?.exchangeRates[currency] ?? FALLBACK_FX_TO_JPY[currency]), [officialData]);
  const origin = useMemo(() => ({ ...originBase, fxToJpy: fxToJpy(originBase.currency) }), [fxToJpy, originBase]);
  const destination = useMemo(() => ({ ...destinationBase, fxToJpy: fxToJpy(destinationBase.currency) }), [destinationBase, fxToJpy]);
  const grossOriginInput = Number(salary) || 0;
  const grossOrigin = salaryCurrency === "JPY" ? grossOriginInput / origin.fxToJpy : grossOriginInput;
  const destinationSameYenGross = origin.fxToJpy === destination.fxToJpy ? grossOrigin : (grossOrigin * origin.fxToJpy) / destination.fxToJpy;
  const destinationBenchmarkSource = officialSalaryBenchmarkSource(destination);
  const enteredDestinationSalary = Number(destinationSalary);
  const destinationGross = destinationSalaryMode === "localBenchmark"
    ? destinationBenchmarkSource ? destination.averageAnnualIncome : null
    : destinationSalaryMode === "actualOffer"
      ? Number.isFinite(enteredDestinationSalary) && enteredDestinationSalary > 0 ? enteredDestinationSalary : null
      : destinationSameYenGross;

  const results = useMemo(() => ({
    origin: calculateCity(origin, grossOrigin, household, housing, lifestyle, ageBand),
    destination: calculateCity(destination, destinationGross, household, housing, lifestyle, ageBand),
  }), [origin, destination, grossOrigin, destinationGross, household, housing, lifestyle, ageBand]);
  const selectedCities = [origin, destination];
  const selectedFxAutomatic = Boolean(officialData && selectedCities.every((city) => city.currency === "JPY" || typeof officialData.exchangeRates[city.currency] === "number"));

  const { recommendations, recommendationCoverage } = useMemo(() => {
    const candidates = cityOrder.map((cityId) => {
      const candidateBase = cities[cityId];
      const city = { ...candidateBase, fxToJpy: fxToJpy(candidateBase.currency) };
      const profile = globalBusinessProfilesByCity.get(city.id) ?? null;
      const businessCoverage: RecommendationBusinessCoverage = profile ? "detailed" : "reference";
      const businessRawScore = profile?.score ?? city.scores.business;
      const businessAdjustedScore = profile ? businessRawScore : businessRawScore * REFERENCE_BUSINESS_CONFIDENCE;
      const actualOfferJpy = Number.isFinite(enteredDestinationSalary) && enteredDestinationSalary > 0 ? enteredDestinationSalary * destination.fxToJpy : null;
      const candidateGross = destinationSalaryMode === "localBenchmark"
        ? officialSalaryBenchmarkSource(city) ? city.averageAnnualIncome : null
        : destinationSalaryMode === "actualOffer"
          ? actualOfferJpy === null ? null : actualOfferJpy / city.fxToJpy
          : origin.fxToJpy === city.fxToJpy ? grossOrigin : (grossOrigin * origin.fxToJpy) / city.fxToJpy;
      const result = calculateCity(city, candidateGross, household, housing, lifestyle, ageBand);
      return {
        city,
        profile,
        businessCoverage,
        businessRawScore,
        businessAdjustedScore,
        result,
        remainingJpy: result.monthlyRemaining === null ? null : result.monthlyRemaining * city.fxToJpy,
      };
    });
    const remainingValues = candidates.flatMap((candidate) => candidate.remainingJpy === null ? [] : [candidate.remainingJpy]);
    const minRemaining = remainingValues.length > 0 ? Math.min(...remainingValues) : 0;
    const maxRemaining = remainingValues.length > 0 ? Math.max(...remainingValues) : 0;
    const businessValues = candidates.map((candidate) => candidate.businessAdjustedScore);
    const livabilityValues = candidates.map((candidate) => candidate.result.scores.livability);
    const normalize = (value: number, min: number, max: number) => max === min ? 100 : clamp(((value - min) / (max - min)) * 100);
    const weights = recommendationWeights[recommendationPriority];

    const ranked = candidates.map((candidate) => {
      const moneyScore = candidate.remainingJpy === null ? 0 : normalize(candidate.remainingJpy, minRemaining, maxRemaining);
      const businessScore = normalize(candidate.businessAdjustedScore, Math.min(...businessValues), Math.max(...businessValues));
      const livabilityScore = normalize(candidate.result.scores.livability, Math.min(...livabilityValues), Math.max(...livabilityValues));
      const factors = {
        money: moneyScore * weights.money,
        business: businessScore * weights.business,
        livability: livabilityScore * weights.livability,
      };
      const strongestFactor = Object.entries(factors).sort(([, left], [, right]) => right - left)[0][0] as keyof typeof factors;
      return { ...candidate, strongestFactor, fitScore: Math.round(factors.money + factors.business + factors.livability) };
    }).sort((left, right) => right.fitScore - left.fitScore || right.businessAdjustedScore - left.businessAdjustedScore).slice(0, 3);

    return {
      recommendations: ranked,
      recommendationCoverage: {
        candidateCount: candidates.length,
        detailedBusinessCount: candidates.filter((candidate) => candidate.businessCoverage === "detailed").length,
        referenceBusinessCount: candidates.filter((candidate) => candidate.businessCoverage === "reference").length,
        moneyAvailableCount: candidates.filter((candidate) => candidate.remainingJpy !== null).length,
      },
    };
  }, [ageBand, destination.fxToJpy, destinationSalaryMode, enteredDestinationSalary, fxToJpy, grossOrigin, household, housing, lifestyle, origin.fxToJpy, recommendationPriority]);

  const handleCalculate = () => {
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const compareBusinessCity = (cityId: CityId) => {
    setDestinationId(cityId);
    requestAnimationFrame(() => requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };

  const openMethodDetails = () => {
    setDetailsOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("method")?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };

  const authSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage(null);
    if (!supabaseConfigured) {
      setAuthMessage(t.supabaseNotConfigured);
      return;
    }
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail, password: authPassword }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503 && data.configured === false) setSupabaseConfigured(false);
        setAuthMessage(data.error ?? t.authError);
        return;
      }
      if (data.user && !data.needsEmailConfirmation) {
        setAuthUser(data.user);
        setAuthMessage(t.authSuccess);
        await loadCloudHistory();
      } else {
        setAuthMessage(language === "ja" ? "登録しました。確認メールが届いた場合は、メールのリンクを押してからログインしてください。" : "Your account was created. If confirmation is required, follow the email link and then log in.");
        setAuthMode("login");
      }
      setAuthPassword("");
    } catch {
      setAuthMessage(t.authError);
    } finally {
      setHistoryLoading(false);
    }
  };

  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (data?.configured === false) setSupabaseConfigured(false);
    setAuthUser(null);
    setHistory(data?.configured === false ? readLocalHistory() : []);
    setAuthMessage(t.authSuccess);
  };

  const saveCurrentComparison = async () => {
    if (historyLoading) return;
    setAuthMessage(null);
    const input: SavedComparisonInput = { originId, destinationId, salary, salaryCurrency, destinationSalaryMode, destinationSalary, household, housing, lifestyle, ageBand };
    const result = {
      originMonthlyRemaining: results.origin.monthlyRemaining,
      destinationMonthlyRemaining: results.destination.monthlyRemaining,
      originMonthlyRemainingYen: results.origin.monthlyRemaining === null ? null : results.origin.monthlyRemaining * origin.fxToJpy,
      destinationMonthlyRemainingYen: results.destination.monthlyRemaining === null ? null : results.destination.monthlyRemaining * destination.fxToJpy,
    };
    const recordBase = { title: `${displayCityName(origin)} → ${displayCityName(destination)}`, origin_city: originId, destination_city: destinationId, input, result, created_at: new Date().toISOString() };
    const saveLocally = () => {
      const localRecord: HistoryRecord = {
        id: localHistoryId(),
        title: recordBase.title,
        origin_city: recordBase.origin_city,
        destination_city: recordBase.destination_city,
        input: recordBase.input as unknown as Record<string, unknown>,
        result: recordBase.result as Record<string, unknown>,
        created_at: recordBase.created_at,
      };
      const next = [localRecord, ...readLocalHistory()].slice(0, LOCAL_HISTORY_LIMIT);
      if (!writeLocalHistory(next)) {
        setAuthMessage(t.authError);
        return;
      }
      setHistory(next);
      setAuthMessage(t.historyLocalNote);
    };

    if (supabaseConfigured && authUser) {
      setHistoryLoading(true);
      try {
        const response = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recordBase) });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 503 && data.configured === false) {
            setAuthUser(null);
            setSupabaseConfigured(false);
            saveLocally();
            return;
          }
          setAuthMessage(data.error ?? t.authError);
          return;
        }
        if (data.record) setHistory((current) => [data.record as HistoryRecord, ...current].slice(0, 50));
        setAuthMessage(t.authSuccess);
      } catch {
        setAuthMessage(t.authError);
      } finally {
        setHistoryLoading(false);
      }
      return;
    }

    if (supabaseConfigured) {
      setAuthMessage(t.authRequired);
      return;
    }

    saveLocally();
  };

  const restoreHistory = (record: HistoryRecord) => {
    if (isSavedAnalyzerInput(record.input)) {
      if (!queueAnalyzerRestore(record)) {
        setAuthMessage(t.authError);
        return;
      }
      window.location.assign("/analyze");
      return;
    }
    const input = record.input as Partial<SavedComparisonInput>;
    if (typeof input.originId !== "string" || !(input.originId in cities) || typeof input.destinationId !== "string" || !(input.destinationId in cities)) {
      setAuthMessage(language === "ja" ? "この履歴は現在の都市データと合わないため呼び出せません。" : "This history entry no longer matches the current city data.");
      return;
    }
    setOriginId(input.originId as CityId);
    setDestinationId(input.destinationId as CityId);
    if (typeof input.salary === "string") setSalary(input.salary);
    if (input.salaryCurrency === "origin" || input.salaryCurrency === "JPY") setSalaryCurrency(input.salaryCurrency);
    if (input.destinationSalaryMode === "localBenchmark" || input.destinationSalaryMode === "sameYen" || input.destinationSalaryMode === "actualOffer") setDestinationSalaryMode(input.destinationSalaryMode);
    else setDestinationSalaryMode("sameYen");
    if (typeof input.destinationSalary === "string") setDestinationSalary(input.destinationSalary);
    if (input.household && input.household in householdMultipliers) setHousehold(input.household);
    if (input.housing && input.housing in housingMultipliers) setHousing(input.housing);
    if (input.lifestyle && input.lifestyle in lifestyleMultipliers) setLifestyle(input.lifestyle);
    if (input.ageBand === "under40" || input.ageBand === "40to64" || input.ageBand === "65plus") setAgeBand(input.ageBand);
    setHistoryOpen(false);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const deleteHistory = async (record: HistoryRecord) => {
    if (supabaseConfigured && authUser && !record.id.startsWith("local-")) {
      const response = await fetch(`/api/history?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 503 && data?.configured === false) {
          setAuthUser(null);
          setSupabaseConfigured(false);
          setAuthMessage(t.historyLocalNote);
          return;
        }
        setAuthMessage(t.authError);
        return;
      }
    }
    const next = history.filter((item) => item.id !== record.id);
    if (!supabaseConfigured && !writeLocalHistory(next)) {
      setAuthMessage(t.authError);
      return;
    }
    setHistory(next);
  };

  const swapCities = () => {
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  const resetForm = () => {
    setOriginId("tokyo");
    setDestinationId("singapore");
    setSalary("8500000");
    setSalaryCurrency("origin");
    setDestinationSalaryMode("localBenchmark");
    setDestinationSalary("");
    setHousehold("single");
    setHousing("onebed");
    setLifestyle("balanced");
    setAgeBand("under40");
  };

  const categoryRows = [
    [t.rent, results.origin.rent, results.destination.rent],
    [t.food, origin.costs.food * householdMultipliers[household] * lifestyleMultipliers[lifestyle], destination.costs.food * householdMultipliers[household] * lifestyleMultipliers[lifestyle]],
    [t.utilities, origin.costs.utilities * lifestyleMultipliers[lifestyle], destination.costs.utilities * lifestyleMultipliers[lifestyle]],
    [t.internet, origin.costs.internet, destination.costs.internet],
    [t.transport, origin.costs.transport * householdMultipliers[household], destination.costs.transport * householdMultipliers[household]],
    [t.medical, origin.costs.medical * householdMultipliers[household], destination.costs.medical * householdMultipliers[household]],
    [t.leisure, origin.costs.leisure * lifestyleMultipliers[lifestyle], destination.costs.leisure * lifestyleMultipliers[lifestyle]],
  ];
  const citySourceLinks = [...new Map([...origin.dataSources, ...destination.dataSources].map((source) => [source.url, source])).values()];

  return (
    <main lang={language} className={`app-shell ${darkMode ? "is-dark" : "is-light"}`}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Life Atlas">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Life Atlas</span>
        </a>
        <nav className="desktop-nav" aria-label={language === "ja" ? "主要メニュー" : "Main menu"}>
          <Link href="/analyze" onClick={() => trackProductEvent("landing_to_analyzer", { placement: "navigation" })}>Offer Analyzer</Link>
          <Link href="/pricing">Pricing</Link>
          <a href="#compare">{t.navCompare}</a>
          <a href="#recommendations">{language === "ja" ? "おすすめ" : "Matches"}</a>
          <a href="#profile">{t.navProfile}</a>
          <a href="#global-business">{language === "ja" ? "世界のビジネス" : "Global business"}</a>
          <a href="#method" onClick={(event) => { event.preventDefault(); openMethodDetails(); }}>{t.navMethod}</a>
        </nav>
        <div className="header-actions">
          <button className="language-button" onClick={() => setLanguage((value) => value === "ja" ? "en" : "ja")} aria-label={t.languageAria}>{t.languageSwitch}</button>
          <button className="theme-button" onClick={() => setDarkMode((value) => !value)} aria-label={t.themeAria}>
            {darkMode ? t.themeToLight : t.themeToDark}
          </button>
        </div>
      </header>

      <div id="top" className="page-wrap">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.heroEyebrow}</p>
            <h1 id="hero-title">{t.heroTitleBefore}<em>{t.heroTitleEmphasis}</em>{t.heroTitleAfter}</h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-pills">
              <span>{t.pillCities}</span><span>{t.pillCurrencies}</span><span>{t.pillDeductions}</span>
            </div>
            <div className="hero-cta-row">
              <Link className="hero-cta" href="/analyze" onClick={() => trackProductEvent("landing_to_analyzer", { placement: "hero" })}>{language === "ja" ? "オファーを比較する" : "Compare my offers"}<span>→</span></Link>
              <a className="hero-secondary-cta" href="#compare">{language === "ja" ? "都市を比較する" : "Explore cities"}</a>
            </div>
          </div>
          <div className="hero-visual" aria-label={language === "ja" ? "海と海外の街並み" : "Coastal international city"}>
            <div className="hero-visual-caption"><span>48°51′N · COASTAL EDITION</span><strong>{language === "ja" ? "暮らす場所を、意思で選ぶ。" : "Choose where life can expand."}</strong></div>
            <div className="hero-visual-score"><small>{language === "ja" ? "注目都市" : "Spotlight"}</small><strong>10</strong><span>{language === "ja" ? "公式情報源で比較" : "official-source profiles"}</span></div>
          </div>
        </section>

        <section id="account" className="account-card section-anchor" aria-labelledby="account-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Life Atlas</p>
              <h2 id="account-title">{t.accountTitle}</h2>
            </div>
            <p className="section-note">{t.accountDescription}</p>
          </div>

          {!authUser ? (
            <form className="account-grid" onSubmit={authSubmit}>
              <a className="oauth-button" href="/api/auth/oauth/google?next=/dashboard">{t.googleLogin}</a>
              <div className="auth-divider"><span>{t.orEmail}</span></div>
              <label>{t.email}
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" required />
              </label>
              <label>{t.password}
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} autoComplete={authMode === "login" ? "current-password" : "new-password"} required />
              </label>
              <div className="account-actions">
                <button className="primary-button" type="submit" disabled={historyLoading}>{authMode === "login" ? t.login : t.register}</button>
                <button className="text-button" type="button" onClick={() => { setAuthMode((mode) => mode === "login" ? "signup" : "login"); setAuthMessage(null); }}>
                  {authMode === "login" ? t.switchToSignup : t.switchToLogin}
                </button>
              </div>
            </form>
          ) : (
            <div className="account-status">
              <span>{t.loggedInAs} <strong>{authUser.email}</strong></span>
              <button className="text-button" type="button" onClick={() => void logout()}>{t.logout}</button>
            </div>
          )}

          <p className="account-note">{supabaseConfigured ? t.historyCloudNote : t.historyLocalNote}</p>
          <div className="account-actions">
            <button className="primary-button" type="button" onClick={() => void saveCurrentComparison()} disabled={historyLoading}>{t.saveComparison}</button>
            <button className="secondary-button" type="button" onClick={() => { setHistoryOpen((open) => !open); if (supabaseConfigured && authUser) void loadCloudHistory(); }}>{t.historyTitle}</button>
          </div>
          {authMessage && <p className="account-message" role="status">{authMessage}</p>}

          {historyOpen && (
            <div className="history-list">
              <h3>{supabaseConfigured ? t.historyTitle : t.localHistoryTitle}</h3>
              {history.length === 0 ? (
                <p className="account-note">{t.historyEmpty}</p>
              ) : history.map((record) => (
                <article className="history-item" key={record.id}>
                  <div>
                    <strong>{record.title}</strong>
                    <small>{t.savedAt}: {new Date(record.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small>
                  </div>
                  <div className="history-item-actions">
                    <button className="secondary-button" type="button" onClick={() => restoreHistory(record)}>{t.restore}</button>
                    <button className="text-button" type="button" onClick={() => void deleteHistory(record)}>{t.delete}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="compare" className="comparison-card section-anchor">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t.compareEyebrow}</p>
              <h2>{t.compareTitle}</h2>
            </div>
            <p className="section-note">{t.salaryNotSaved}</p>
          </div>
          <div className="form-grid city-form-row">
            <label>{t.origin}
              <select value={originId} onChange={(event) => setOriginId(event.target.value as CityId)}>
                {cityOrder.map((id) => <option key={id} value={id}>{displayCityName(cities[id])} / {displayCityCountry(cities[id])}</option>)}
              </select>
            </label>
            <button className="swap-button" onClick={swapCities} aria-label={t.swapAria}>↔</button>
            <label>{t.destination}
              <select value={destinationId} onChange={(event) => setDestinationId(event.target.value as CityId)}>
                {cityOrder.map((id) => <option key={id} value={id}>{displayCityName(cities[id])} / {displayCityCountry(cities[id])}</option>)}
              </select>
            </label>
          </div>
          <div className="form-grid five-columns">
            <label className="salary-field">{t.salary}
              <div className="input-with-unit"><input inputMode="numeric" value={salary} onChange={(event) => setSalary(event.target.value.replace(/[^0-9]/g, ""))} aria-label={t.salary} /><select className="currency-input-select" value={salaryCurrency} onChange={(event) => setSalaryCurrency(event.target.value as SalaryCurrency)} aria-label={t.salaryCurrency}><option value="origin">{origin.currency}</option><option value="JPY">JPY</option></select></div>
              <small>{salaryCurrency === "JPY" ? `${t.jpyCurrency} → ${t.originCurrency}` : t.salaryHint}</small>
            </label>
            <label>{t.household}
              <select value={household} onChange={(event) => setHousehold(event.target.value as keyof typeof householdMultipliers)}>
                <option value="single">{t.householdSingle}</option>
                <option value="couple">{t.householdCouple}</option>
                <option value="singleParent">{t.householdSingleParent}</option>
                <option value="coupleOneChild">{t.householdOneChild}</option>
                <option value="family">{t.householdTwoChildren}</option>
                <option value="familyThreeChildren">{t.householdThreeChildren}</option>
              </select>
              <small>{language === "ja" ? "子どもの人数に応じて生活費を調整" : "Living costs adjust by number of children"}</small>
            </label>
            <label>{t.housing}
              <select value={housing} onChange={(event) => setHousing(event.target.value as keyof typeof housingMultipliers)}>
                <option value="shared">{t.housingShared}</option>
                <option value="studio">{t.housingStudio}</option>
                <option value="onebed">{t.housingOnebed}</option>
                <option value="condo">{t.housingCondo}</option>
                <option value="twobed">{t.housingTwobed}</option>
                <option value="house">{t.housingHouse}</option>
              </select>
              <small>{language === "ja" ? "住居タイプごとの家賃差を概算" : "Rent is adjusted approximately by housing type"}</small>
            </label>
            <label>{t.lifestyle}
              <select value={lifestyle} onChange={(event) => setLifestyle(event.target.value as keyof typeof lifestyleMultipliers)}>
                <option value="lean">{t.lifestyleLean}</option><option value="balanced">{t.lifestyleBalanced}</option><option value="comfortable">{t.lifestyleComfortable}</option>
              </select>
            </label>
            <label>{t.ageBand}
              <select value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)}>
                <option value="under40">{t.ageUnder40}</option><option value="40to64">{t.age40to64}</option><option value="65plus">{t.age65plus}</option>
              </select>
              <small>{t.ageHint}</small>
            </label>
          </div>
          <div className="salary-scenario-grid">
            <label>{t.destinationSalaryMode}
              <select value={destinationSalaryMode} onChange={(event) => {
                const mode = event.target.value as DestinationSalaryMode;
                setDestinationSalaryMode(mode);
              }}>
                <option value="localBenchmark">{t.localBenchmarkSalary}</option>
                <option value="sameYen">{t.sameYenSalary}</option>
                <option value="actualOffer">{t.actualOfferSalary}</option>
              </select>
              <small>{destinationSalaryMode === "localBenchmark"
                ? destinationBenchmarkSource
                  ? `${money(destination.averageAnnualIncome, destination.currency)} / ${language === "ja" ? "年" : "year"} · ${sourceLevel(destinationBenchmarkSource.level, language)} · ${sourcePeriod(destinationBenchmarkSource.period, language)} · ${destinationBenchmarkSource.source}`
                  : t.salaryBenchmarkUnavailableDetail
                : destinationSalaryMode === "sameYen" ? t.sameYenSalaryHint : t.destinationSalaryHint}</small>
            </label>
            {destinationSalaryMode === "actualOffer" && <label>{t.destinationSalary}
              <div className="input-with-unit"><input inputMode="numeric" value={destinationSalary} onChange={(event) => setDestinationSalary(event.target.value.replace(/[^0-9]/g, ""))} aria-label={t.destinationSalary} /><span>{destination.currency}</span></div>
              <small>{t.destinationSalaryHint}</small>
            </label>}
          </div>
          <div className="form-actions">
            <button className="primary-button" onClick={handleCalculate}>{t.compare} <span>→</span></button>
            <button className="text-button" onClick={resetForm}>{t.reset}</button>
          </div>
          <p className="section-note tax-assumption-note">{t.assumption}</p>
        </section>

        <div ref={resultRef} className="result-anchor" />
        <section className="result-section">
          <div className="section-heading result-heading">
            <div><p className="eyebrow">{t.resultEyebrow}</p><h2>{t.resultTitle}</h2></div>
            <div className="data-actions">
              <span className={`data-status ${dataLoading ? "is-loading" : selectedFxAutomatic ? "is-live" : "is-partial"}`}>
                <span className="data-status-dot" />
                {dataLoading ? t.dataLoading : selectedFxAutomatic ? t.dataLive : t.dataPartial}
              </span>
              <button className="data-refresh-button" type="button" onClick={() => void refreshOfficialData()} disabled={dataLoading}>
                {dataLoading ? t.updating : t.update}
              </button>
            </div>
            {dataError && <span className="data-error">{dataError} {t.fallback}</span>}
          </div>
          <div className="data-coverage-panel" aria-label={t.dataCoverageTitle}>
            <div className="data-coverage-heading">
              <div><span>{t.dataCoverageTitle}</span><strong>{t.dataCoverageSummary}</strong></div>
              <small>{t.retrievedLabel}: {officialData ? new Date(officialData.retrievedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US") : dataLoading ? t.dataLoading : language === "ja" ? "未取得" : "Unavailable"}</small>
            </div>
            <div className="data-coverage-grid">
              {selectedCities.map((city) => {
                const populationSource = city.dataSources.find((item) => item.item.includes("人口"));
                const populationIsEstimate = !populationSource || /Life Atlas|推定|保存参考値/.test(populationSource.source);
                const salaryBenchmarkSource = officialSalaryBenchmarkSource(city);
                const countryPopulation = officialData?.populations[city.countryCode] ?? null;
                const fxIsBase = city.currency === "JPY";
                const fxIsAutomatic = !fxIsBase && typeof officialData?.exchangeRates[city.currency] === "number";
                const fxSource = officialData?.sources.find((item) => item.name.includes("European Central Bank"));
                return <article className="data-coverage-card" key={city.id}>
                  <div className="data-coverage-city"><span>{displayCityCountry(city)}</span><h3>{displayCityName(city)}</h3></div>
                  <div className="coverage-item">
                    <div className="coverage-label"><span>{t.cityPopulationBaseline}</span><small className={`coverage-badge ${populationIsEstimate ? "is-estimate" : "is-snapshot"}`}>{populationIsEstimate ? t.estimateValue : t.officialSnapshot}</small></div>
                    <strong>{localizedCityPopulation(city, language)}</strong>
                    <p>{populationSource ? <><span>{t.scopeLabelText}: {sourceLevel(populationSource.level, language)} / {sourcePeriod(populationSource.period, language)}</span><a href={populationSource.url} target="_blank" rel="noreferrer">{t.sourceLabelText}: {populationIsEstimate && language === "en" ? "Life Atlas estimate based on public statistics" : populationSource.source} ↗</a></> : <span>{t.baselineDateUnknown}</span>}</p>
                  </div>
                  <div className="coverage-item">
                    <div className="coverage-label"><span>{t.countryPopulationReference}</span><small className={`coverage-badge ${countryPopulation ? "is-live" : "is-reference"}`}>{countryPopulation ? t.automatic : t.countryPopulationUnavailable}</small></div>
                    <strong>{countryPopulation ? formatPopulation(countryPopulation.value, countryPopulation.year, displayCityCountry(city), language) : "—"}</strong>
                    <p><span>{t.scopeLabelText}: {language === "ja" ? "国（都市人口ではありません）" : "Country (not city population)"}</span>{officialData?.sources[0] && <a href={officialData.sources[0].url} target="_blank" rel="noreferrer">{t.sourceLabelText}: World Bank Indicators API ↗</a>}</p>
                  </div>
                  <div className="coverage-item">
                    <div className="coverage-label"><span>{t.exchangeRateLabel}</span><small className={`coverage-badge ${fxIsAutomatic ? "is-live" : fxIsBase ? "is-snapshot" : "is-reference"}`}>{fxIsAutomatic ? t.automatic : fxIsBase ? t.baseCurrency : t.referenceValue}</small></div>
                    <strong>{fxIsBase ? t.jpyBaseCurrency : `1 ${city.currency} = ${formatYen(city.fxToJpy, language)}`}</strong>
                    <p><span>{fxIsAutomatic && officialData?.exchangeObservedOn ? `${t.scopeLabelText}: ${city.currency} / ${officialData.exchangeObservedOn}` : fxIsBase ? `${t.scopeLabelText}: JPY` : `${t.scopeLabelText}: ${city.currency} / ${t.baselineDateUnknown}`}</span>{fxIsAutomatic && fxSource && <a href={fxSource.url} target="_blank" rel="noreferrer">{t.sourceLabelText}: ECB ↗</a>}</p>
                  </div>
                  <div className="coverage-item">
                    <div className="coverage-label"><span>{t.salaryBenchmark}</span><small className={`coverage-badge ${salaryBenchmarkSource ? "is-snapshot" : "is-reference"}`}>{salaryBenchmarkSource ? t.officialSnapshot : t.salaryBenchmarkUnavailable}</small></div>
                    <strong>{salaryBenchmarkSource ? `${formatMoney(city.averageAnnualIncome, city.currency, language)} / ${language === "ja" ? "年" : "year"}` : "—"}</strong>
                    <p>{salaryBenchmarkSource ? <><span>{t.scopeLabelText}: {sourceLevel(salaryBenchmarkSource.level, language)} / {sourcePeriod(salaryBenchmarkSource.period, language)}</span><a href={salaryBenchmarkSource.url} target="_blank" rel="noreferrer">{t.sourceLabelText}: {salaryBenchmarkSource.source} ↗</a></> : <span>{t.salaryBenchmarkUnavailableDetail}</span>}</p>
                  </div>
                  <div className="coverage-item">
                    <div className="coverage-label"><span>{t.taxesInsurance}</span><small className={`coverage-badge ${taxCalculationStatus(city) === "official-scenario" ? "is-live" : taxCalculationStatus(city) === "official-rate-estimate" ? "is-estimate" : "is-reference"}`}>{calculationLabel(taxCalculationStatus(city))}</small></div>
                    <strong>{taxCalculationStatus(city) === "unavailable" ? t.calculationUnavailable : language === "ja" ? "長期就労する日本人会社員・税務上の居住者" : "Long-term Japanese employee treated as a tax resident"}</strong>
                    <p><span>{language === "ja" ? "扶養・個別控除・任意保険などは含みません" : "Excludes individual reliefs, dependants and optional insurance"}</span>{city.dataSources.find((item) => item.item === "所得税") && <a href={city.dataSources.find((item) => item.item === "所得税")?.url} target="_blank" rel="noreferrer">{t.sourceLabelText}: {city.dataSources.find((item) => item.item === "所得税")?.source} ↗</a>}</p>
                  </div>
                </article>;
              })}
            </div>
            {officialData && <p className="data-coverage-footnote">{language === "ja" ? `対象: ${officialData.coverage.cityCount}都市・${officialData.coverage.currencyCount}通貨。国人口 ${officialData.coverage.automaticCountryCount}/${officialData.coverage.countryCount}、為替 ${officialData.coverage.automaticCurrencyCount}/${officialData.coverage.currencyCount} を今回自動取得。都市人口の保存値は更新していません。` : `Coverage: ${officialData.coverage.cityCount} cities and ${officialData.coverage.currencyCount} currencies. This check retrieved ${officialData.coverage.automaticCountryCount}/${officialData.coverage.countryCount} country populations and ${officialData.coverage.automaticCurrencyCount}/${officialData.coverage.currencyCount} FX rates. Saved city-population baselines were not updated.`}</p>}
          </div>
          <div className="result-grid">
            {[results.origin, results.destination].map((result, index) => {
              const breakdown = result.taxBreakdown;
              return <article className={`city-result-card ${index === 1 ? "featured-result" : ""} ${breakdown ? "" : "calculation-unavailable"}`} data-city-id={result.city.id} data-tax-status={result.taxCalculationStatus} key={result.city.id}>
                <div className="city-card-top"><div><span className="city-region">{displayCityRegion(result.city)} / {displayCityCountry(result.city)}</span><h3>{displayCityName(result.city)}</h3></div><span className="city-initial">{displayCityName(result.city).slice(0, 1)}</span></div>
                <div className={`calculation-badge is-${result.calculationUnavailableReason === "salary" ? "unavailable" : result.taxCalculationStatus}`}>{result.calculationUnavailableReason === "salary" ? t.salaryBenchmarkUnavailable : calculationLabel(result.taxCalculationStatus)}</div>
                <div className="big-number">{optionalMoney(result.monthlyRemaining, result.city.currency)}{result.monthlyRemaining !== null && <small>{t.monthly}</small>}</div>
                <div className="yen-caption">{result.monthlyRemaining === null ? unavailableDetail(result) : <>{t.yenValue} {optionalYen(result.monthlyRemaining * result.city.fxToJpy)}</>}</div>
                <div className="metric-list">
                  <div><span>{t.takeHome}</span><strong>{optionalDualMoney(result.netMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.taxesInsurance}</span><strong>{optionalDualMoney(breakdown?.totalDeductionsMonthly ?? null, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.monthlySpend}</span><strong>{dualMoney(result.totalMonthlyCosts, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.rentBurden}</span><strong>{result.rentBurden === null ? "—" : `${result.rentBurden.toFixed(1)}%`}</strong></div>
                </div>
                {breakdown ? <div className="deduction-list">
                  <div className="deduction-heading">{t.deductionHeading}</div>
                  <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.federalProvincialTax : result.city.taxSystem === "us" ? t.federalStateCityTax : t.incomeTax}</span><strong>{dualMoney(breakdown.incomeTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  {result.city.taxSystem === "japan" ? <>
                    <div className="deduction-row"><span>{t.reconstructionTax}</span><strong>{dualMoney(breakdown.reconstructionSurtaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.residentTax}</span><strong>{dualMoney(breakdown.residentTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.healthInsurance}</span><strong>{dualMoney(breakdown.healthInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.pension}</span><strong>{dualMoney(breakdown.pensionMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.employmentInsurance}</span><strong>{dualMoney(breakdown.employmentInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    {ageBand === "40to64" && <div className="deduction-row"><span>{t.careInsurance}</span><strong>{dualMoney(breakdown.careInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    <div className="deduction-row"><span>{t.childSupport}</span><strong>{dualMoney(breakdown.childSupportMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  </> : <>
                    {breakdown.residentTaxMonthly > 0 && <div className="deduction-row"><span>{t.localTax}</span><strong>{dualMoney(breakdown.residentTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {breakdown.healthInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "us" ? t.employerHealth : result.city.taxSystem === "france" ? t.medicalSocial : result.city.taxSystem === "mexico" ? t.imssHealth : t.healthInsurance}</span><strong>{dualMoney(breakdown.healthInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {breakdown.pensionMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.cppPension : result.city.taxSystem === "us" ? t.socialSecurity : result.city.taxSystem === "italy" ? t.inpsPension : result.city.taxSystem === "mexico" ? t.retirementFund : result.city.taxSystem === "france" ? t.pensionInsurance : t.retirement}</span><strong>{dualMoney(breakdown.pensionMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {breakdown.employmentInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? "EI employment insurance" : result.city.taxSystem === "uk" ? "National Insurance" : result.city.taxSystem === "france" ? t.unemployment : t.employmentInsurance}</span><strong>{dualMoney(breakdown.employmentInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {breakdown.medicareLevyMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "australia" ? "Medicare levy" : t.medicare}</span><strong>{dualMoney(breakdown.medicareLevyMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {breakdown.employerSuperMonthly > 0 && <div className="deduction-row is-employer"><span>{t.employerSuper}</span><strong>{dualMoney(breakdown.employerSuperMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                  </>}
                  <div className="deduction-total"><span>{t.deductionTotal}</span><strong>{dualMoney(breakdown.totalDeductionsMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                </div> : <div className="deduction-list unavailable-note"><strong>{unavailableTitle(result)}</strong><span>{unavailableDetail(result)}</span></div>}
                <div className="card-footer"><span className="status-dot" /> {index === 0 ? t.currentScenario : destinationSalaryMode === "localBenchmark" ? t.localBenchmarkScenario : destinationSalaryMode === "actualOffer" ? t.actualOfferScenario : t.sameYenScenario}</div>
              </article>;
            })}
          </div>
          <div className="headline-callout"><span className="callout-icon">↗</span><div><strong>{results.origin.monthlyRemaining === null || results.destination.monthlyRemaining === null ? unavailableDetail(results.destination.monthlyRemaining === null ? results.destination : results.origin) : results.destination.monthlyRemaining > results.origin.monthlyRemaining ? (language === "ja" ? `${displayCityName(destination)}の方が、月間の余裕が大きい試算です。` : `${displayCityName(destination)} has more monthly room in this estimate.`) : (language === "ja" ? `${displayCityName(origin)}の方が、月間の余裕が大きい試算です。` : `${displayCityName(origin)} has more monthly room in this estimate.`)}</strong><p>{t.calloutNote}</p></div></div>
        </section>

        <section className="split-section">
          <div className="panel cost-panel">
            <div className="panel-heading"><div><p className="eyebrow">{t.costEyebrow}</p><h2>{t.costTitle}</h2></div><span className="unit-note">{t.localCurrency}</span></div>
            <div className="legend"><span><i className="legend-origin" /> {displayCityName(origin)}</span><span><i className="legend-destination" /> {displayCityName(destination)}</span></div>
            <div className="cost-rows">
              {categoryRows.map(([label, originValue, destinationValue]) => {
                const originValueYen = Number(originValue) * origin.fxToJpy;
                const destinationValueYen = Number(destinationValue) * destination.fxToJpy;
                const max = Math.max(originValueYen, destinationValueYen);
                return <div className="cost-row" key={label as string}><div className="cost-label"><span>{label}</span><small>{dualMoney(Number(originValue), origin.currency, origin.fxToJpy)} / {dualMoney(Number(destinationValue), destination.currency, destination.fxToJpy)}</small></div><div className="bars"><span className="bar bar-origin" style={{ width: `${Math.max(8, (originValueYen / max) * 100)}%` }} /><span className="bar bar-destination" style={{ width: `${Math.max(8, (destinationValueYen / max) * 100)}%` }} /></div></div>;
              })}
            </div>
            <p className="panel-footnote">{t.yenFootnote}</p>
          </div>
          <div className="panel asset-panel">
            <div className="panel-heading"><div><p className="eyebrow">{t.assetEyebrow}</p><h2>{t.assetTitle}</h2></div><span className="sparkle">✦</span></div>
            <div className="asset-compare"><div><span>{displayCityName(origin)}</span><strong>{optionalDualMoney(results.origin.annualSavings, origin.currency, origin.fxToJpy)}</strong><small>{t.annualSavings}</small></div><div className="asset-divider">vs</div><div><span>{displayCityName(destination)}</span><strong>{optionalDualMoney(results.destination.annualSavings, destination.currency, destination.fxToJpy)}</strong><small>{t.annualSavings}</small></div></div>
            <div className="index-grid"><div><span>{t.costIndex}</span><strong>{results.origin.costIndex}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.origin.purchasingPower ?? "—"}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.costIndex}</span><strong>{results.destination.costIndex}</strong><small>{displayCityName(destination)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.destination.purchasingPower ?? "—"}</strong><small>{displayCityName(destination)}</small></div></div>
            <div className="fire-note"><span>{t.fireNote}</span><strong>{t.fireTitle}</strong><small>{t.fireDescription}</small></div>
          </div>
        </section>

        <section id="profile" className="profile-section section-anchor">
          <div className="section-heading"><div><p className="eyebrow">{t.profileEyebrow}</p><h2>{t.profileTitle}</h2></div><p className="section-note">{t.profileNote}</p></div>
          <div className="profile-grid">
            {[origin, destination].map((city) => {
              return <article className="profile-card" key={city.id}><div className="profile-header"><div><span className="city-region">{displayCityRegion(city)} / {displayCityCountry(city)}</span><h3>{displayCityName(city)}</h3></div><span className="currency-chip">{city.currency}</span></div><div className="profile-facts"><div><span>{t.population}</span><strong>{localizedCityPopulation(city, language)}</strong></div><div><span>{t.timezone}</span><strong>{language === "ja" ? city.timezone : cityTimezoneEnglish[city.id] ?? city.timezone}</strong></div><div><span>{t.climate}</span><strong>{displayCityClimate(city)}</strong></div><div><span>{t.officialLanguage}</span><strong>{displayCityLanguage(city)}</strong></div></div><div className="profile-tags"><span>{t.japaneseFood} {city.scores.japaneseFood}/100</span><span>{t.englishLiving} {city.scores.english}/100</span><span>{t.internetScore} {city.scores.internet}/100</span><span>{t.transitScore} {city.scores.transit}/100</span></div><p className="source-quality">{t.dataCoverage}{language === "ja" ? city.sourceLabel : taxCalculationStatus(city) === "unavailable" ? "Population, salary, rent and living costs are saved reference scenarios. Tax and social-insurance calculations are unavailable and financial results are hidden." : "Public sources and saved reference scenarios are separated. The tax status shown above states whether this is a verified foreign-worker scenario or a simplified official-rate estimate."}</p></article>;
            })}
          </div>
        </section>

        <section className="score-section">
          <div className="section-heading"><div><p className="eyebrow">{t.scoreEyebrow}</p><h2>{t.scoreTitle}</h2></div><span className="score-note">{t.scoreNote}</span></div>
          <div className="score-board"><div className="score-city-labels"><span /><strong>{displayCityName(origin)}</strong><strong>{displayCityName(destination)}</strong></div>{scoreRows.map(([labelJa, labelEn, key]) => {
            const originScore = results.origin.scores[key];
            const destinationScore = results.destination.scores[key];
            return <div className="score-row" key={key}><span className="score-name">{language === "ja" ? labelJa : labelEn}</span><div className="score-value"><div className="score-track"><span className="score-fill origin-fill" style={{ width: `${originScore ?? 0}%` }} /></div><strong>{originScore ?? "—"}</strong></div><div className="score-value"><div className="score-track"><span className="score-fill destination-fill" style={{ width: `${destinationScore ?? 0}%` }} /></div><strong>{destinationScore ?? "—"}</strong></div></div>;
          })}</div>
          <p className="panel-footnote">{t.scoreFootnote}</p>
        </section>

        <section id="recommendations" className="recommendation-section section-anchor">
          <div className="recommendation-heading">
            <div><p className="eyebrow">07 / YOUR CITY MATCHES</p><h2>{language === "ja" ? "今の条件から、次に見るべき3都市。" : "Three cities worth exploring next."}</h2></div>
            <p>{language === "ja" ? "Life Atlasの50都市すべてを対象に、入力済みの給与・世帯・住居・生活スタイル条件と、ビジネス環境・暮らしやすさを重ねて候補を更新します。" : "All 50 Life Atlas cities are evaluated using your salary, household, housing and lifestyle inputs alongside business conditions and livability."}</p>
          </div>
          <div className="recommendation-coverage" aria-label={language === "ja" ? "おすすめのデータ範囲" : "Recommendation data coverage"}>
            <span><strong>{recommendationCoverage.candidateCount}</strong>{language === "ja" ? "対象都市" : "cities evaluated"}</span>
            <span><strong>{recommendationCoverage.detailedBusinessCount}</strong>{language === "ja" ? "ビジネス詳細あり" : "with detailed business data"}</span>
            <span><strong>{recommendationCoverage.referenceBusinessCount}</strong>{language === "ja" ? "ビジネス参考値" : "with reference business data"}</span>
            <span><strong>{recommendationCoverage.moneyAvailableCount}</strong>{language === "ja" ? "金額計算可能" : "with money calculations"}</span>
          </div>
          <div className="recommendation-priority" role="group" aria-label={language === "ja" ? "候補都市の優先軸" : "City match priority"}>
            {(["balance", "money", "business"] as RecommendationPriority[]).map((priority) => <button key={priority} type="button" className={recommendationPriority === priority ? "is-active" : ""} aria-pressed={recommendationPriority === priority} onClick={() => setRecommendationPriority(priority)}>{priority === "balance" ? (language === "ja" ? "バランス重視" : "Balanced") : priority === "money" ? (language === "ja" ? "手元資金重視" : "Money left") : (language === "ja" ? "ビジネス重視" : "Business first")}</button>)}
          </div>
          <div className="recommendation-grid">
            {recommendations.map((recommendation, index) => {
              const reason = recommendation.strongestFactor === "money" ? (language === "ja" ? "現在の条件で手元資金を残しやすい" : "Stronger money-left outlook for your inputs") : recommendation.strongestFactor === "business" ? recommendation.businessCoverage === "detailed" ? (language === "ja" ? "事業環境の詳細情報が充実" : "Strong detailed business conditions") : (language === "ja" ? "ビジネス参考値は信頼度を補正済み" : "Reference business data is confidence-adjusted") : (language === "ja" ? "暮らしやすさとのバランスが良い" : "Good balance with livability");
              return <article className="recommendation-card" key={recommendation.city.id} data-city-id={recommendation.city.id} data-business-coverage={recommendation.businessCoverage}>
                <div className="recommendation-rank"><span>0{index + 1}</span><small>{language === "ja" ? "候補" : "MATCH"}</small></div>
                <div className="recommendation-city"><span>{displayCityCountry(recommendation.city)}</span><h3>{displayCityName(recommendation.city)}</h3><p>{reason}</p></div>
                <div className="recommendation-fit"><strong>{recommendation.fitScore}</strong><small>/ 100 {language === "ja" ? "適合度" : "fit"}</small></div>
                <div className="recommendation-metrics"><div><span>{language === "ja" ? "月に残る試算" : "Money left / month"}</span><strong>{recommendation.remainingJpy === null ? "—" : yen(recommendation.remainingJpy)}</strong></div><div><span>{language === "ja" ? "ビジネス（補正後）" : "Business (adjusted)"}</span><strong>{Math.round(recommendation.businessAdjustedScore)}</strong></div><div><span>{language === "ja" ? "暮らしやすさ" : "Livability"}</span><strong>{recommendation.result.scores.livability}</strong></div></div>
                <p className={`recommendation-data-badge is-${recommendation.businessCoverage}`}>{recommendation.businessCoverage === "detailed" ? (language === "ja" ? "ビジネス詳細データあり" : "Detailed business data") : (language === "ja" ? "詳細未整備・参考スコアを50%補正" : "Limited detail · reference score weighted at 50%")}</p>
                <p className="recommendation-fit-copy"><span>{recommendation.profile ? (language === "ja" ? "向いている事業" : "Strong fit") : (language === "ja" ? "評価範囲" : "Coverage note")}</span>{recommendation.profile ? recommendation.profile.fit[language] : (language === "ja" ? "給与・生活費・暮らしやすさを中心に評価。詳細な法人設立・税・外国人要件は未整備です。" : "Evaluated mainly on salary, living costs and livability; detailed incorporation, tax and foreign-founder data is not yet available.")}</p>
                <button className="business-compare-button" type="button" onClick={() => compareBusinessCity(recommendation.city.id)} aria-label={language === "ja" ? `${displayCityName(recommendation.city)}を目的地に設定して詳しく比較する` : `Compare ${displayCityName(recommendation.city)} in detail`}><span>{language === "ja" ? "この都市を詳しく比較する" : "Compare this city in detail"}</span><strong>→</strong></button>
              </article>;
            })}
          </div>
          <div className="recommendation-method"><span>{language === "ja" ? "現在の配点" : "Current weighting"}</span><strong>{recommendationPriority === "balance" ? (language === "ja" ? "手元資金40%・ビジネス35%・暮らし25%" : "Money 40% · Business 35% · Livability 25%") : recommendationPriority === "money" ? (language === "ja" ? "手元資金60%・ビジネス20%・暮らし20%" : "Money 60% · Business 20% · Livability 20%") : (language === "ja" ? "手元資金20%・ビジネス60%・暮らし20%" : "Money 20% · Business 60% · Livability 20%")}</strong><p>{language === "ja" ? "50都市すべてを候補にします。選択した働き方で給与または税金・社会保険を計算できない都市は手元資金を0点として扱います。ビジネス詳細が未整備の都市は既存の参考スコアを50%補正し、データ不足だけで高順位にならないようにしています。移住・投資・税務判断を代替するものではありません。" : "All 50 cities remain eligible. Cities without salary or tax and social-insurance calculations for the selected work scenario receive zero for the money factor. Where detailed business data is unavailable, the existing reference score is weighted at 50% so missing data cannot produce an inflated rank. This does not replace relocation, investment or tax advice."}</p></div>
        </section>

        <section id="global-business" className="global-business-section section-anchor">
          <div className="business-intro">
            <div><p className="eyebrow">08 / GLOBAL BUSINESS ATLAS</p><h2>{language === "ja" ? "事業の始めやすさを、空気感だけで選ばない。" : "Choose a business city with evidence, not atmosphere alone."}</h2></div>
            <p>{language === "ja" ? "法人設立、外国人要件、デジタル手続き、税率、業種適性を公式情報源から整理。スコアは比較の入り口であり、最終判断ではありません。" : "Official sources are organized around incorporation, foreign-founder rules, digital access, tax and sector fit. Scores are a starting point, never a final legal or tax decision."}</p>
          </div>
          <div className="business-method-strip" aria-label={language === "ja" ? "ビジネススコアの構成" : "Business score components"}>
            <span>30% {language === "ja" ? "設立・運営" : "Setup"}</span><span>20% {language === "ja" ? "電子政府" : "Digital"}</span><span>20% {language === "ja" ? "外国人適性" : "Foreign fit"}</span><span>15% {language === "ja" ? "税・予見性" : "Tax"}</span><span>15% {language === "ja" ? "市場接続" : "Market"}</span>
          </div>
          <div className="global-business-grid">
            {globalBusinessProfiles.map((profile, index) => <article className="global-business-card" key={profile.cityId}>
              <div className="business-card-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="business-card-top"><div><span>{profile.country[language]}</span><h3>{profile.city[language]}</h3></div><div className="business-score"><strong>{profile.score}</strong><small>/ 100</small></div></div>
              <div className="business-meter"><span style={{ width: `${profile.score}%` }} /></div>
              <div className="business-stat-row"><div><small>{language === "ja" ? "デジタル" : "Digital"}</small><strong>{profile.digital}</strong></div><div><small>{language === "ja" ? "税の目安" : "Tax guide"}</small><strong>{profile.tax[language]}</strong></div></div>
              <div className="business-copy"><div><small>{language === "ja" ? "設立・外国人要件" : "Setup and foreign-founder rules"}</small><p>{profile.setup[language]}</p></div><div><small>{language === "ja" ? "向いている事業" : "Strong fit"}</small><p>{profile.fit[language]}</p></div><div className="business-watch"><small>{language === "ja" ? "先に確認" : "Check first"}</small><p>{profile.watch[language]}</p></div></div>
              <div className="business-card-actions">
                <button className="business-compare-button" type="button" onClick={() => compareBusinessCity(profile.cityId)} aria-label={language === "ja" ? `${profile.city.ja}を目的地に設定して比較する` : `Compare with ${profile.city.en} as the destination`}>
                  <span>{language === "ja" ? "この都市を比較する" : "Compare this city"}</span><strong>→</strong>
                </button>
                <a className="business-source" href={profile.url} target="_blank" rel="noreferrer"><span>{profile.source}</span><strong>{language === "ja" ? "公式情報" : "Official source"} ↗</strong></a>
              </div>
            </article>)}
          </div>
          <p className="business-disclaimer">{language === "ja" ? "調査基準日: 2026年8月18日。法人税は標準税率または代表的な区分で、控除・地方税・業種別制度を反映しない場合があります。移民、就労、外資、許認可は案件ごとに専門家へ確認してください。" : "Research date: 18 August 2026. Tax figures are headline or representative rates and may exclude reliefs, local taxes and sector regimes. Immigration, work, ownership and licensing rules require case-specific professional advice."} <a href="https://www.worldbank.org/en/businessready/publications" target="_blank" rel="noreferrer">World Bank B-READY 2025 ↗</a> · <a href="https://desapublications.un.org/publications/un-e-government-survey-2024" target="_blank" rel="noreferrer">UN E-Government Survey 2024 ↗</a> · <a href="https://www.oecd.org/en/publications/corporate-tax-statistics-2025_6a915941-en.html" target="_blank" rel="noreferrer">OECD Corporate Tax Statistics 2025 ↗</a></p>
        </section>

        <section className="details-grid">
          <div className="mini-panel"><span className="mini-icon">◎</span><div><h3>{t.businessTitle}</h3><p>{t.businessText}</p><a className="inline-link" href="#global-business">{t.moreDetails} <span>→</span></a></div></div>
          <div className="mini-panel"><span className="mini-icon">⌁</span><div><h3>{t.transparencyTitle}</h3><p>{t.transparencyText}</p><button className="inline-link" onClick={openMethodDetails}>{t.sourcesNotes} <span>→</span></button><Link className="inline-link" href={`/data${language === "en" ? "?lang=en" : ""}`}>{language === "ja" ? "50都市のデータ一覧" : "All 50 cities"} <span>→</span></Link></div></div>
        </section>

        {detailsOpen && <section id="method" className="method-panel section-anchor"><div className="section-heading"><div><p className="eyebrow">{t.methodEyebrow}</p><h2>{t.methodTitle}</h2></div><button className="close-button" onClick={() => setDetailsOpen(false)}>{t.close}</button></div><div className="method-grid"><div><span>{t.dataStatus}</span><strong>{dataLoading ? t.dataLoading : selectedFxAutomatic ? t.dataLiveMethod : t.dataFallbackMethod}</strong><p>{language === "ja" ? "都市人口は各統計の公表時点を保存し、国人口はWorld Bank、対応通貨の為替はECBから自動取得します。更新操作で都市人口の基準日は書き換えません。" : "City population keeps its published statistical baseline. Country population comes from the World Bank and supported FX rates come from the ECB. Refreshing does not rewrite a city-population date."} {t.retrievedAt}{officialData ? new Date(officialData.retrievedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US") : language === "ja" ? "未取得" : "Not available"}</p></div><div><span>{t.cityCosts}</span><strong>{t.cityCostsStrong}</strong><p>{t.cityCostsText}</p></div><div><span>{t.taxes}</span><strong>{t.taxesStrong}</strong><p>{t.taxesText}</p></div><div><span>{t.formula}</span><strong>{t.formulaStrong}</strong><p>{t.formulaText}</p></div></div>{officialData && <div className="source-list"><span>{t.autoSources}</span>{officialData.sources.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noreferrer">{source.name} <small>（{sourceScope(source.scope, language)}）</small> ↗</a>)}</div>}<div className="source-list"><span>{t.citySources}</span>{citySourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source} <small>（{sourceItem(source.item, language)} / {sourceLevel(source.level, language)} / {sourcePeriod(source.period, language)}）</small> ↗</a>)}</div><Link className="secondary-button" href={`/methodology${language === "en" ? "?lang=en" : ""}`}>{language === "ja" ? "計算方法の詳細" : "Full methodology"}</Link></section>}

        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">✦</span><strong>Life Atlas</strong><p>{t.footerText}</p></div><div className="footer-meta"><Link href="/pricing">Pricing</Link><Link href={`/methodology${language === "en" ? "?lang=en" : ""}`}>{language === "ja" ? "計算方法" : "Method"}</Link><Link href={`/data${language === "en" ? "?lang=en" : ""}`}>Data</Link><span>{t.footerCities}</span><span>{t.footerDeductions}</span><span>© 2026 Life Atlas</span></div></footer>
      </div>
    </main>
  );
}
