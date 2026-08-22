"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CityId = "tokyo" | "osaka" | "vancouver" | "toronto" | "losAngeles" | "newYork" | "london" | "paris" | "rome" | "queretaro" | "puebla" | "merida" | "mexicoCity" | "melbourne" | "sapporo" | "fukuoka" | "seoul" | "taipei" | "singapore" | "hongKong" | "bangkok" | "kualaLumpur" | "jakarta" | "manila" | "hoChiMinh" | "beijing" | "shanghai" | "sydney" | "brisbane" | "perth" | "montreal" | "calgary" | "chicago" | "dallas" | "sanFrancisco" | "miami" | "boston" | "seattle" | "washingtonDc" | "madrid" | "berlin" | "amsterdam" | "lisbon" | "dubai" | "zurich" | "dublin" | "saoPaulo" | "buenosAires" | "santiago" | "bogota";
type CurrencyCode = "JPY" | "CAD" | "USD" | "GBP" | "EUR" | "MXN" | "AUD" | "KRW" | "TWD" | "SGD" | "HKD" | "THB" | "MYR" | "IDR" | "PHP" | "VND" | "CNY" | "AED" | "CHF" | "BRL" | "ARS" | "CLP" | "COP";
type AgeBand = "under40" | "40to64" | "65plus";
type SalaryCurrency = "origin" | "JPY";
type Language = "ja" | "en";
type RecommendationPriority = "balance" | "money" | "business";

type DataSource = {
  item: string;
  level: "都市" | "都道府県" | "州" | "国" | "国・州" | "州・市" | "都市圏" | "自治体";
  period: string;
  source: string;
  url: string;
};

type InsuranceConfig = {
  healthRateEmployee: number;
  careRateEmployee: number;
  childSupportRateEmployee: number;
  pensionRateEmployee: number;
  employmentRateEmployee: number;
  employmentCap?: number;
  pensionBaseExemption?: number;
  pensionAnnualMax?: number;
  pensionSecondRateEmployee?: number;
  pensionSecondStart?: number;
  pensionSecondCap?: number;
  pensionSecondAnnualMax?: number;
  socialSecurityRateEmployee: number;
  socialSecurityWageBase?: number;
  additionalMedicareRate?: number;
  additionalMedicareThreshold?: number;
  medicareRate: number;
  employerSuperRate: number;
  healthInsuranceEmployeeMonthly: number;
  healthInsuranceFamilyMonthly: number;
  source: string;
};

type City = {
  id: CityId;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  currency: CurrencyCode;
  currencyLabel: string;
  fxToJpy: number;
  timezone: string;
  climate: string;
  language: string;
  population: string;
  taxSystem: "japan" | "canada" | "us" | "uk" | "france" | "italy" | "mexico" | "australia" | "estimate";
  taxRegion: string;
  insurance: InsuranceConfig;
  averageAnnualIncome: number;
  costs: {
    rent: number;
    food: number;
    utilities: number;
    internet: number;
    transport: number;
    medical: number;
    leisure: number;
  };
  jobs: Record<string, number>;
  scores: {
    livability: number;
    business: number;
    nomad: number;
    family: number;
    safety: number;
    healthcare: number;
    internet: number;
    transit: number;
    nature: number;
    japaneseFood: number;
    english: number;
  };
  dataSources: DataSource[];
  sourceLabel: string;
  updatedAt: string;
  englishName?: string;
  englishCountry?: string;
  englishRegion?: string;
  englishClimate?: string;
  englishLanguage?: string;
};

type CityResult = {
  city: City;
  grossAnnual: number;
  grossMonthly: number;
  taxMonthly: number;
  netMonthly: number;
  rent: number;
  livingCosts: number;
  totalMonthlyCosts: number;
  monthlyRemaining: number;
  annualSavings: number;
  rentBurden: number;
  costIndex: number;
  purchasingPower: number;
  taxBreakdown: {
    incomeTaxMonthly: number;
    reconstructionSurtaxMonthly: number;
    residentTaxMonthly: number;
    medicareLevyMonthly: number;
    healthInsuranceMonthly: number;
    careInsuranceMonthly: number;
    childSupportMonthly: number;
    pensionMonthly: number;
    employmentInsuranceMonthly: number;
    totalTaxMonthly: number;
    totalInsuranceMonthly: number;
    totalDeductionsMonthly: number;
    employerSuperMonthly: number;
  };
  scores: {
    livability: number;
    savings: number;
    business: number;
    fire: number;
    nomad: number;
    family: number;
    overall: number;
  };
};

type OfficialData = {
  sourceStatus: "live" | "partial" | "fallback";
  retrievedAt: string;
  populations: Record<string, { value: number; year: string } | null>;
  exchangeRates: {
    [currency: string]: number | null;
  };
  exchangeObservedOn: string | null;
  cityFacts: Partial<Record<CityId, { population: { value: number; period: string } | null; sources: DataSource[] }>>;
  sources: Array<{ name: string; scope: string; url: string }>;
  warnings: string[];
};

type HistoryRecord = {
  id: string;
  title: string;
  origin_city: string;
  destination_city: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
};

type SavedComparisonInput = {
  originId: CityId;
  destinationId: CityId;
  salary: string;
  salaryCurrency: SalaryCurrency;
  household: keyof typeof householdMultipliers;
  housing: keyof typeof housingMultipliers;
  lifestyle: keyof typeof lifestyleMultipliers;
  ageBand: AgeBand;
};

const LOCAL_HISTORY_KEY = "life-atlas-comparison-history";
const LOCAL_HISTORY_LIMIT = 50;
const FALLBACK_FX_TO_JPY: Record<CurrencyCode, number> = { JPY: 1, CAD: 108, USD: 145, GBP: 190, EUR: 170, MXN: 8.5, AUD: 98, KRW: 0.108, TWD: 4.55, SGD: 108, HKD: 18.6, THB: 4.15, MYR: 34, IDR: 0.009, PHP: 2.55, VND: 0.0058, CNY: 20.1, AED: 39.5, CHF: 181, BRL: 27, ARS: 0.13, CLP: 0.15, COP: 0.035 };

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Partial<HistoryRecord>;
  return typeof record.id === "string"
    && typeof record.title === "string"
    && typeof record.origin_city === "string"
    && typeof record.destination_city === "string"
    && typeof record.created_at === "string"
    && typeof record.input === "object"
    && record.input !== null
    && !Array.isArray(record.input)
    && typeof record.result === "object"
    && record.result !== null
    && !Array.isArray(record.result);
}

function readLocalHistory(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(LOCAL_HISTORY_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter(isHistoryRecord).slice(0, LOCAL_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(history: HistoryRecord[]) {
  try {
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, LOCAL_HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

function localHistoryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const source = (item: string, level: DataSource["level"], period: string, sourceName: string, url: string): DataSource => ({ item, level, period, source: sourceName, url });
const japanSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "都市", "2026年", "総務省統計局・消費者物価指数", "https://www.stat.go.jp/data/cpi/1.html"), source("給与", "都道府県", "2025年調査", "厚生労働省・賃金構造基本統計調査", "https://www.mhlw.go.jp/toukei/list/chinginkouzou_a.html"), source("所得税", "国", "2026年分", "国税庁・令和8年分源泉徴収税額表", "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/01.htm"), source("健康保険・介護保険", "都道府県", "2026年度", "協会けんぽ・令和8年度保険料率", "https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/"), source("年金", "国", "2026年度", "日本年金機構・厚生年金保険料率", "https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150515-01.html"), source("雇用保険", "国", "2026年度", "厚生労働省・令和8年度雇用保険料率", "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html")];
const canadaSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "Statistics Canada・Consumer Price Index", "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes"), source("連邦・州所得税", "国・州", "2026年", "Canada Revenue Agency・Tax rates and brackets", "https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canada-income-tax-rates-individuals-current-previous-years.html"), source("CPP・EI", "国", "2026年", "Canada Revenue Agency・Payroll deductions", "https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html")];
const usSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "U.S. Bureau of Labor Statistics・CPI", "https://www.bls.gov/cpi/"), source("連邦所得税", "国", "2026年", "Internal Revenue Service・Inflation adjustments", "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill"), source("社会保障・Medicare", "国", "2026年", "Social Security Administration・2026 Fact Sheet", "https://www.ssa.gov/cola/factsheets/2026.html"), source("医療保険", "国", "2025年調査", "KFF・Employer Health Benefits Survey", "https://www.kff.org/health-costs/2025-employer-health-benefits-survey/"), source("州税・市税", "州・市", "2026年", "各州・市の税務当局", "https://www.tax.ny.gov/pit/file/tax-tables/")];
const ukSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "Office for National Statistics・CPI", "https://www.ons.gov.uk/economy/inflationandpriceindices"), source("所得税", "国", "2026-27年度", "GOV.UK・Income Tax rates", "https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past"), source("国民保険", "国", "2026-27年度", "GOV.UK・National Insurance", "https://www.gov.uk/national-insurance/how-much-you-pay")];
const franceSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "INSEE・Consumer Price Index", "https://www.insee.fr/en/statistiques?debut=0&theme=30"), source("所得税", "国", "2026年・2025年所得", "impots.gouv.fr・2026年税率", "https://www.impots.gouv.fr/particulier/questions/quoi-correspondent-le-taux-moyen-et-le-taux-marginal-dimposition-affiches-sur"), source("社会保険", "国", "2026年", "URSSAF・民間部門の保険料率", "https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html")];
const italySources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "ISTAT・Consumer prices", "https://www.istat.it/en/consumer-prices/"), source("所得税", "国", "2026年", "Agenzia delle Entrate・IRPEF", "https://www.agenziaentrate.gov.it/portale/irpef"), source("社会保険", "国", "2026年", "INPS・2026年保険料資料", "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html")];
const mexicoSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価", "国", "2026年", "INEGI・Índice Nacional de Precios", "https://www.inegi.org.mx/temas/inpc/"), source("所得税", "国", "2026年", "SAT・Anexo 8 RMF 2026", "https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo-8-RMF-2026_DOF-28122025.pdf"), source("社会保険", "国", "2026年", "IMSS・SUA／社会保険料", "https://www.imss.gob.mx/patrones/sua")];
const australiaSources = (populationSource: DataSource): DataSource[] => [populationSource, source("物価・家賃", "国", "2026年", "Australian Bureau of Statistics・CPI", "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release"), source("所得税・Medicare levy", "国", "2026-27年度", "Australian Taxation Office・Tax rates", "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents"), source("退職積立", "国", "2026-27年度", "Australian Taxation Office・Super guarantee", "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee")];

const japanInsurance = (healthRateEmployee: number): InsuranceConfig => ({ healthRateEmployee, careRateEmployee: 0.0081, childSupportRateEmployee: 0.00115, pensionRateEmployee: 0.0915, employmentRateEmployee: 0.005, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "協会けんぽ・厚生年金・雇用保険（2026年度、労働者負担）" });
const canadaInsurance: InsuranceConfig = { healthRateEmployee: 0, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0.0595, employmentRateEmployee: 0.0163, pensionBaseExemption: 3_500, pensionAnnualMax: 4_230.45, pensionSecondRateEmployee: 0.04, pensionSecondStart: 74_600, pensionSecondCap: 85_000, pensionSecondAnnualMax: 416, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "Canada Revenue Agency・CPP／EI（2026年）" };
const usInsurance: InsuranceConfig = { healthRateEmployee: 0, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0, employmentRateEmployee: 0, socialSecurityRateEmployee: 0.062, socialSecurityWageBase: 184_500, additionalMedicareRate: 0.009, additionalMedicareThreshold: 200_000, medicareRate: 0.0145, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 120, healthInsuranceFamilyMonthly: 571, source: "SSA・FICA（2026年）およびKFF医療保険加入者負担（2025年調査）" };
const ukInsurance: InsuranceConfig = { healthRateEmployee: 0, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0, employmentRateEmployee: 0.08, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "GOV.UK・National Insurance Class 1（2026-27年度）" };
const franceInsurance: InsuranceConfig = { healthRateEmployee: 0.085, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0.09, employmentRateEmployee: 0.045, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "URSSAF・民間部門の社会保険料（比較用推定）" };
const italyInsurance: InsuranceConfig = { healthRateEmployee: 0, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0.0919, employmentRateEmployee: 0, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "INPS・被用者年金保険料（2026年）" };
const mexicoInsurance: InsuranceConfig = { healthRateEmployee: 0.02375, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0.00125, employmentRateEmployee: 0, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "IMSS・給与条件により変動する労働者負担の比較用推定" };
const australiaInsurance: InsuranceConfig = { healthRateEmployee: 0, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0, employmentRateEmployee: 0, socialSecurityRateEmployee: 0, medicareRate: 0.02, employerSuperRate: 0.12, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "ATO・Medicare levy・Super guarantee（2026-27年度）" };

const cityBase = (id: CityId, name: string, country: string, countryCode: string, region: string, currency: CurrencyCode, currencyLabel: string, timezone: string, climate: string, language: string, population: string, taxSystem: City["taxSystem"], taxRegion: string, insurance: InsuranceConfig, averageAnnualIncome: number, costs: City["costs"], jobs: Record<string, number>, scores: City["scores"], dataSources: DataSource[], sourceLabel: string): City => ({ id, name, country, countryCode, region, currency, currencyLabel, fxToJpy: 1, timezone, climate, language, population, taxSystem, taxRegion, insurance, averageAnnualIncome, costs, jobs, scores, dataSources, sourceLabel, updatedAt: "2026年7月26日" });

const baseCities: Partial<Record<CityId, City>> = {
  tokyo: cityBase("tokyo", "東京", "日本", "JPN", "アジア", "JPY", "日本円", "UTC+9（日本標準時）", "温暖湿潤・四季がある", "日本語", "14,246,219人（東京都・2025年10月1日速報）", "japan", "tokyo", japanInsurance(0.04925), 5_700_000, { rent: 185_000, food: 65_000, utilities: 18_000, internet: 5_500, transport: 15_000, medical: 10_000, leisure: 30_000 }, { "IT職": 7_200_000, "エンジニア": 6_800_000, "営業": 5_500_000, "一般事務": 4_200_000 }, { livability: 88, business: 76, nomad: 68, family: 84, safety: 86, healthcare: 88, internet: 91, transit: 96, nature: 72, japaneseFood: 100, english: 38 }, japanSources(source("人口", "都道府県", "2025年10月1日速報", "東京都・令和7年国勢調査速報", "https://www.metro.tokyo.lg.jp/information/press/2026/05/2026052914")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  osaka: cityBase("osaka", "大阪", "日本", "JPN", "アジア", "JPY", "日本円", "UTC+9（日本標準時）", "温暖湿潤・比較的温暖", "日本語", "2,817,627人（大阪市・2026年7月1日推計）", "japan", "osaka", japanInsurance(0.05065), 5_100_000, { rent: 135_000, food: 60_000, utilities: 17_000, internet: 5_500, transport: 12_000, medical: 10_000, leisure: 28_000 }, { "IT職": 6_500_000, "エンジニア": 6_100_000, "営業": 5_000_000, "一般事務": 3_900_000 }, { livability: 89, business: 79, nomad: 70, family: 86, safety: 82, healthcare: 88, internet: 91, transit: 91, nature: 76, japaneseFood: 100, english: 36 }, japanSources(source("人口", "都市", "2026年7月1日", "大阪市・推計人口", "https://www.city.osaka.lg.jp/toshikeikaku/page/0000541634.html")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  vancouver: cityBase("vancouver", "バンクーバー", "カナダ", "CAN", "北米", "CAD", "カナダドル", "UTC-8（夏時間あり）", "海洋性・雨が多く冬は温和", "英語・フランス語", "約264万人（Metro Vancouver・2021年国勢調査）", "canada", "britishColumbia", canadaInsurance, 95_000, { rent: 2_800, food: 700, utilities: 150, internet: 90, transport: 110, medical: 70, leisure: 300 }, { "IT職": 120_000, "エンジニア": 115_000, "営業": 85_000, "一般事務": 58_000 }, { livability: 85, business: 80, nomad: 84, family: 86, safety: 78, healthcare: 82, internet: 89, transit: 82, nature: 98, japaneseFood: 82, english: 100 }, canadaSources(source("人口", "都市圏", "2021年国勢調査", "Statistics Canada・Census Profile", "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm?Lang=E")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  toronto: cityBase("toronto", "トロント", "カナダ", "CAN", "北米", "CAD", "カナダドル", "UTC-5（夏時間あり）", "湿潤大陸性・四季がある", "英語・フランス語", "約620万人（Toronto CMA・2021年国勢調査）", "canada", "ontario", canadaInsurance, 90_000, { rent: 2_400, food: 680, utilities: 145, internet: 90, transport: 156, medical: 70, leisure: 300 }, { "IT職": 115_000, "エンジニア": 108_000, "営業": 82_000, "一般事務": 56_000 }, { livability: 84, business: 88, nomad: 82, family: 84, safety: 76, healthcare: 84, internet: 91, transit: 84, nature: 78, japaneseFood: 88, english: 100 }, canadaSources(source("人口", "都市圏", "2021年国勢調査", "Statistics Canada・Census Profile", "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm?Lang=E")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  losAngeles: cityBase("losAngeles", "ロサンゼルス", "アメリカ", "USA", "北米", "USD", "米ドル", "UTC-8（夏時間あり）", "地中海性・乾燥して温暖", "英語", "3,820,914人（市・2023年推計）", "us", "california", usInsurance, 90_000, { rent: 2_800, food: 700, utilities: 190, internet: 80, transport: 200, medical: 100, leisure: 300 }, { "IT職": 125_000, "エンジニア": 120_000, "営業": 78_000, "一般事務": 52_000 }, { livability: 76, business: 87, nomad: 86, family: 76, safety: 63, healthcare: 82, internet: 90, transit: 58, nature: 84, japaneseFood: 86, english: 100 }, usSources(source("人口", "都市", "2023年推計", "U.S. Census Bureau・QuickFacts", "https://www.census.gov/quickfacts/losangelescitycalifornia")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  newYork: cityBase("newYork", "ニューヨーク", "アメリカ", "USA", "北米", "USD", "米ドル", "UTC-5（夏時間あり）", "湿潤大陸性・四季がある", "英語", "8,478,072人（市・2024年推計）", "us", "newYork", usInsurance, 110_000, { rent: 3_400, food: 800, utilities: 180, internet: 80, transport: 140, medical: 100, leisure: 350 }, { "IT職": 145_000, "エンジニア": 140_000, "営業": 105_000, "一般事務": 65_000 }, { livability: 78, business: 96, nomad: 92, family: 72, safety: 67, healthcare: 90, internet: 94, transit: 96, nature: 65, japaneseFood: 92, english: 100 }, usSources(source("人口", "都市", "2024年推計", "U.S. Census Bureau・New York City population", "https://www.census.gov/quickfacts/newyorkcitynewyork")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  london: cityBase("london", "ロンドン", "イギリス", "GBR", "ヨーロッパ", "GBP", "英ポンド", "UTC+0（夏時間あり）", "海洋性・冬は温和", "英語", "約890万人（Greater London・2023年）", "uk", "england", ukInsurance, 55_000, { rent: 2_100, food: 400, utilities: 220, internet: 40, transport: 180, medical: 50, leisure: 250 }, { "IT職": 78_000, "エンジニア": 72_000, "営業": 52_000, "一般事務": 34_000 }, { livability: 82, business: 94, nomad: 90, family: 78, safety: 74, healthcare: 84, internet: 93, transit: 95, nature: 70, japaneseFood: 90, english: 100 }, ukSources(source("人口", "都市圏", "2023年", "Office for National Statistics・Population estimates", "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  paris: cityBase("paris", "パリ", "フランス", "FRA", "ヨーロッパ", "EUR", "ユーロ", "UTC+1（夏時間あり）", "海洋性・夏は温暖", "フランス語", "2,103,778人（市・2023年）", "france", "ileDeFrance", franceInsurance, 48_000, { rent: 1_500, food: 380, utilities: 150, internet: 35, transport: 90, medical: 60, leisure: 200 }, { "IT職": 62_000, "エンジニア": 58_000, "営業": 44_000, "一般事務": 32_000 }, { livability: 83, business: 86, nomad: 88, family: 80, safety: 70, healthcare: 90, internet: 91, transit: 94, nature: 68, japaneseFood: 86, english: 64 }, franceSources(source("人口", "都市", "2023年", "INSEE・人口統計", "https://www.insee.fr/fr/statistiques")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  rome: cityBase("rome", "ローマ", "イタリア", "ITA", "ヨーロッパ", "EUR", "ユーロ", "UTC+1（夏時間あり）", "地中海性・夏は乾燥", "イタリア語", "約280万人（Roma Capitale・2024年）", "italy", "lazio", italyInsurance, 36_000, { rent: 1_100, food: 340, utilities: 160, internet: 30, transport: 45, medical: 55, leisure: 180 }, { "IT職": 48_000, "エンジニア": 45_000, "営業": 34_000, "一般事務": 27_000 }, { livability: 78, business: 70, nomad: 82, family: 78, safety: 68, healthcare: 84, internet: 79, transit: 72, nature: 76, japaneseFood: 70, english: 58 }, italySources(source("人口", "都市", "2024年", "Roma Capitale・人口統計", "https://www.comune.roma.it/web/it/statistica.page")), "人口・物価は公的資料、給与・家賃は地域統計の目安"),
  queretaro: cityBase("queretaro", "ケレタロ", "メキシコ", "MEX", "北米", "MXN", "メキシコペソ", "UTC-6", "高地性・乾燥して温暖", "スペイン語", "1,049,777人（自治体・2020年国勢調査）", "mexico", "queretaro", mexicoInsurance, 360_000, { rent: 15_000, food: 5_000, utilities: 1_800, internet: 600, transport: 1_000, medical: 800, leisure: 2_000 }, { "IT職": 520_000, "エンジニア": 480_000, "営業": 300_000, "一般事務": 210_000 }, { livability: 82, business: 84, nomad: 76, family: 86, safety: 72, healthcare: 72, internet: 78, transit: 66, nature: 80, japaneseFood: 46, english: 42 }, mexicoSources(source("人口", "自治体", "2020年国勢調査", "INEGI・Censo de Población y Vivienda", "https://www.inegi.org.mx/programas/ccpv/2020/")), "人口は公的統計、物価・給与・家賃は地域統計の目安"),
  puebla: cityBase("puebla", "プエブラ", "メキシコ", "MEX", "北米", "MXN", "メキシコペソ", "UTC-6", "高地性・温暖", "スペイン語", "1,692,181人（自治体・2020年国勢調査）", "mexico", "puebla", mexicoInsurance, 300_000, { rent: 11_000, food: 4_500, utilities: 1_600, internet: 550, transport: 800, medical: 700, leisure: 1_600 }, { "IT職": 430_000, "エンジニア": 400_000, "営業": 260_000, "一般事務": 190_000 }, { livability: 78, business: 76, nomad: 72, family: 83, safety: 64, healthcare: 70, internet: 76, transit: 64, nature: 76, japaneseFood: 42, english: 40 }, mexicoSources(source("人口", "自治体", "2020年国勢調査", "INEGI・Censo de Población y Vivienda", "https://www.inegi.org.mx/programas/ccpv/2020/")), "人口は公的統計、物価・給与・家賃は地域統計の目安"),
  merida: cityBase("merida", "メリダ", "メキシコ", "MEX", "北米", "MXN", "メキシコペソ", "UTC-6", "熱帯性・高温多湿", "スペイン語", "995,129人（自治体・2020年国勢調査）", "mexico", "yucatan", mexicoInsurance, 300_000, { rent: 12_000, food: 4_700, utilities: 1_900, internet: 600, transport: 900, medical: 750, leisure: 1_700 }, { "IT職": 420_000, "エンジニア": 390_000, "営業": 255_000, "一般事務": 185_000 }, { livability: 80, business: 72, nomad: 78, family: 85, safety: 68, healthcare: 68, internet: 75, transit: 58, nature: 86, japaneseFood: 38, english: 48 }, mexicoSources(source("人口", "自治体", "2020年国勢調査", "INEGI・Censo de Población y Vivienda", "https://www.inegi.org.mx/programas/ccpv/2020/")), "人口は公的統計、物価・給与・家賃は地域統計の目安"),
  mexicoCity: cityBase("mexicoCity", "メキシコシティ", "メキシコ", "MEX", "北米", "MXN", "メキシコペソ", "UTC-6", "高地性・温暖", "スペイン語", "9,209,944人（市・2020年国勢調査）", "mexico", "mexicoCity", mexicoInsurance, 420_000, { rent: 18_000, food: 5_500, utilities: 1_900, internet: 650, transport: 1_000, medical: 900, leisure: 2_200 }, { "IT職": 620_000, "エンジニア": 570_000, "営業": 360_000, "一般事務": 240_000 }, { livability: 79, business: 92, nomad: 84, family: 74, safety: 57, healthcare: 78, internet: 87, transit: 82, nature: 64, japaneseFood: 62, english: 52 }, mexicoSources(source("人口", "都市", "2020年国勢調査", "INEGI・Censo de Población y Vivienda", "https://www.inegi.org.mx/programas/ccpv/2020/")), "人口は公的統計、物価・給与・家賃は地域統計の目安"),
  melbourne: cityBase("melbourne", "メルボルン", "オーストラリア", "AUS", "オセアニア", "AUD", "オーストラリアドル", "UTC+10（夏時間あり）", "海洋性・一日の気温差が大きい", "英語", "5,435,590人（Greater Melbourne・2025年6月30日）", "australia", "victoria", australiaInsurance, 88_000, { rent: 2_500, food: 720, utilities: 230, internet: 90, transport: 190, medical: 110, leisure: 360 }, { "IT職": 115_000, "エンジニア": 108_000, "営業": 82_000, "一般事務": 68_000 }, { livability: 86, business: 82, nomad: 86, family: 88, safety: 80, healthcare: 86, internet: 89, transit: 85, nature: 91, japaneseFood: 78, english: 100 }, australiaSources(source("人口", "都市", "2024-25年度・2025年6月30日", "Australian Bureau of Statistics・Regional population", "https://www.abs.gov.au/statistics/people/population/regional-population/latest-release")), "人口・物価は公的資料、給与はVictoria州の地域統計の目安"),
};

const estimateInsurance: InsuranceConfig = { healthRateEmployee: 0.03, careRateEmployee: 0, childSupportRateEmployee: 0, pensionRateEmployee: 0.05, employmentRateEmployee: 0.01, socialSecurityRateEmployee: 0, medicareRate: 0, employerSuperRate: 0, healthInsuranceEmployeeMonthly: 0, healthInsuranceFamilyMonthly: 0, source: "各国制度を単純化した比較用推定（公式税額ではありません）" };

type EstimatedCityConfig = {
  id: CityId;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  currency: CurrencyCode;
  currencyLabel: string;
  timezone: string;
  climate: string;
  language: string;
  population: string;
  taxSystem: City["taxSystem"];
  taxRegion: string;
  averageAnnualIncome: number;
  rent: number;
  costs: Omit<City["costs"], "rent">;
  scores: City["scores"];
  englishName: string;
  englishCountry: string;
  englishRegion: string;
  englishClimate: string;
  englishLanguage: string;
};

const estimatedCity = (config: EstimatedCityConfig): City => ({
  ...cityBase(
    config.id,
    config.name,
    config.country,
    config.countryCode,
    config.region,
    config.currency,
    config.currencyLabel,
    config.timezone,
    config.climate,
    config.language,
    config.population,
    config.taxSystem,
    config.taxRegion,
    config.taxSystem === "japan" ? japanInsurance(0.05065) : config.taxSystem === "canada" ? canadaInsurance : config.taxSystem === "us" ? usInsurance : config.taxSystem === "australia" ? australiaInsurance : estimateInsurance,
    config.averageAnnualIncome,
    { rent: config.rent, ...config.costs },
    { "IT職": Math.round(config.averageAnnualIncome * 1.35), "エンジニア": Math.round(config.averageAnnualIncome * 1.28), "営業": Math.round(config.averageAnnualIncome * 1.05), "一般事務": Math.round(config.averageAnnualIncome * 0.78) },
    config.scores,
    [source("人口・物価・給与・家賃", "国", "2026年時点の比較用推定", "各国政府統計・国際統計を基準にしたLife Atlas推定", "https://data.worldbank.org/"), source("税金・保険", "国", "2026年時点の比較用推定", "各国の税務・社会保障制度を基準にしたLife Atlas推定", "https://www.oecd.org/tax/")],
    "人口・物価は公的統計を参照。給与・家賃・税金・保険は国際比較のための推定値です。"
  ),
  englishName: config.englishName,
  englishCountry: config.englishCountry,
  englishRegion: config.englishRegion,
  englishClimate: config.englishClimate,
  englishLanguage: config.englishLanguage,
});

const extendedCities: Record<CityId, City> = Object.fromEntries([
  ["sapporo", estimatedCity({ id: "sapporo", name: "札幌", country: "日本", countryCode: "JPN", region: "アジア", currency: "JPY", currencyLabel: "日本円", timezone: "UTC+9（日本標準時）", climate: "冷涼・積雪がある", language: "日本語", population: "約197万人（札幌市・推計）", taxSystem: "japan", taxRegion: "hokkaido", averageAnnualIncome: 4_800_000, rent: 100_000, costs: { food: 58_000, utilities: 23_000, internet: 5_500, transport: 10_000, medical: 9_000, leisure: 25_000 }, scores: { livability: 86, business: 70, nomad: 66, family: 86, safety: 85, healthcare: 86, internet: 90, transit: 84, nature: 94, japaneseFood: 100, english: 32 }, englishName: "Sapporo", englishCountry: "Japan", englishRegion: "Asia", englishClimate: "Cool, snowy winters", englishLanguage: "Japanese" })],
  ["fukuoka", estimatedCity({ id: "fukuoka", name: "福岡", country: "日本", countryCode: "JPN", region: "アジア", currency: "JPY", currencyLabel: "日本円", timezone: "UTC+9（日本標準時）", climate: "温暖湿潤・比較的温暖", language: "日本語", population: "約165万人（福岡市・推計）", taxSystem: "japan", taxRegion: "fukuoka", averageAnnualIncome: 4_700_000, rent: 105_000, costs: { food: 57_000, utilities: 16_000, internet: 5_500, transport: 10_000, medical: 9_000, leisure: 26_000 }, scores: { livability: 90, business: 82, nomad: 78, family: 87, safety: 84, healthcare: 87, internet: 91, transit: 87, nature: 84, japaneseFood: 100, english: 35 }, englishName: "Fukuoka", englishCountry: "Japan", englishRegion: "Asia", englishClimate: "Warm humid subtropical", englishLanguage: "Japanese" })],
  ["seoul", estimatedCity({ id: "seoul", name: "ソウル", country: "韓国", countryCode: "KOR", region: "アジア", currency: "KRW", currencyLabel: "韓国ウォン", timezone: "UTC+9", climate: "湿潤大陸性・四季がある", language: "韓国語", population: "約940万人（ソウル特別市・推計）", taxSystem: "estimate", taxRegion: "southKorea", averageAnnualIncome: 55_000_000, rent: 1_100_000, costs: { food: 650_000, utilities: 180_000, internet: 45_000, transport: 80_000, medical: 80_000, leisure: 300_000 }, scores: { livability: 84, business: 88, nomad: 84, family: 78, safety: 83, healthcare: 90, internet: 99, transit: 98, nature: 68, japaneseFood: 90, english: 55 }, englishName: "Seoul", englishCountry: "South Korea", englishRegion: "Asia", englishClimate: "Humid continental, four seasons", englishLanguage: "Korean" })],
  ["taipei", estimatedCity({ id: "taipei", name: "台北", country: "台湾", countryCode: "TWN", region: "アジア", currency: "TWD", currencyLabel: "台湾ドル", timezone: "UTC+8", climate: "亜熱帯・夏は暑く湿潤", language: "中国語", population: "約250万人（台北市・推計）", taxSystem: "estimate", taxRegion: "taiwan", averageAnnualIncome: 900_000, rent: 28_000, costs: { food: 12_000, utilities: 3_500, internet: 1_000, transport: 1_500, medical: 1_500, leisure: 6_000 }, scores: { livability: 88, business: 82, nomad: 88, family: 82, safety: 88, healthcare: 92, internet: 96, transit: 94, nature: 73, japaneseFood: 94, english: 58 }, englishName: "Taipei", englishCountry: "Taiwan", englishRegion: "Asia", englishClimate: "Subtropical, hot and humid summers", englishLanguage: "Mandarin Chinese" })],
  ["singapore", estimatedCity({ id: "singapore", name: "シンガポール", country: "シンガポール", countryCode: "SGP", region: "アジア", currency: "SGD", currencyLabel: "シンガポールドル", timezone: "UTC+8", climate: "熱帯・高温多湿", language: "英語・中国語・マレー語・タミル語", population: "約604万人（国・推計）", taxSystem: "estimate", taxRegion: "singapore", averageAnnualIncome: 72_000, rent: 3_100, costs: { food: 700, utilities: 180, internet: 55, transport: 130, medical: 80, leisure: 300 }, scores: { livability: 86, business: 96, nomad: 92, family: 83, safety: 95, healthcare: 93, internet: 98, transit: 99, nature: 67, japaneseFood: 92, english: 100 }, englishName: "Singapore", englishCountry: "Singapore", englishRegion: "Asia", englishClimate: "Tropical, hot and humid", englishLanguage: "English, Mandarin, Malay and Tamil" })],
  ["hongKong", estimatedCity({ id: "hongKong", name: "香港", country: "香港", countryCode: "HKG", region: "アジア", currency: "HKD", currencyLabel: "香港ドル", timezone: "UTC+8", climate: "亜熱帯・夏は高温多湿", language: "中国語・英語", population: "約750万人（香港・推計）", taxSystem: "estimate", taxRegion: "hongKong", averageAnnualIncome: 420_000, rent: 18_000, costs: { food: 7_000, utilities: 1_600, internet: 350, transport: 1_000, medical: 700, leisure: 3_500 }, scores: { livability: 78, business: 94, nomad: 90, family: 70, safety: 88, healthcare: 91, internet: 95, transit: 99, nature: 75, japaneseFood: 94, english: 82 }, englishName: "Hong Kong", englishCountry: "Hong Kong", englishRegion: "Asia", englishClimate: "Subtropical, hot and humid summers", englishLanguage: "Chinese and English" })],
  ["bangkok", estimatedCity({ id: "bangkok", name: "バンコク", country: "タイ", countryCode: "THA", region: "アジア", currency: "THB", currencyLabel: "タイバーツ", timezone: "UTC+7", climate: "熱帯・高温多湿", language: "タイ語", population: "約550万人（バンコク都・推計）", taxSystem: "estimate", taxRegion: "thailand", averageAnnualIncome: 720_000, rent: 22_000, costs: { food: 12_000, utilities: 3_500, internet: 700, transport: 2_500, medical: 2_000, leisure: 6_000 }, scores: { livability: 82, business: 82, nomad: 95, family: 70, safety: 69, healthcare: 82, internet: 88, transit: 80, nature: 72, japaneseFood: 88, english: 66 }, englishName: "Bangkok", englishCountry: "Thailand", englishRegion: "Asia", englishClimate: "Tropical, hot and humid", englishLanguage: "Thai" })],
  ["kualaLumpur", estimatedCity({ id: "kualaLumpur", name: "クアラルンプール", country: "マレーシア", countryCode: "MYS", region: "アジア", currency: "MYR", currencyLabel: "マレーシアリンギット", timezone: "UTC+8", climate: "熱帯・高温多湿", language: "マレー語・英語", population: "約200万人（市・推計）", taxSystem: "estimate", taxRegion: "malaysia", averageAnnualIncome: 84_000, rent: 2_500, costs: { food: 1_600, utilities: 260, internet: 140, transport: 180, medical: 150, leisure: 700 }, scores: { livability: 82, business: 84, nomad: 92, family: 78, safety: 76, healthcare: 82, internet: 88, transit: 76, nature: 79, japaneseFood: 84, english: 84 }, englishName: "Kuala Lumpur", englishCountry: "Malaysia", englishRegion: "Asia", englishClimate: "Tropical, hot and humid", englishLanguage: "Malay and English" })],
  ["jakarta", estimatedCity({ id: "jakarta", name: "ジャカルタ", country: "インドネシア", countryCode: "IDN", region: "アジア", currency: "IDR", currencyLabel: "インドネシアルピア", timezone: "UTC+7", climate: "熱帯・雨季がある", language: "インドネシア語", population: "約1,100万人（市・推計）", taxSystem: "estimate", taxRegion: "indonesia", averageAnnualIncome: 180_000_000, rent: 9_000_000, costs: { food: 5_000_000, utilities: 1_500_000, internet: 500_000, transport: 1_500_000, medical: 800_000, leisure: 2_500_000 }, scores: { livability: 70, business: 80, nomad: 82, family: 68, safety: 58, healthcare: 70, internet: 76, transit: 63, nature: 72, japaneseFood: 76, english: 58 }, englishName: "Jakarta", englishCountry: "Indonesia", englishRegion: "Asia", englishClimate: "Tropical with a rainy season", englishLanguage: "Indonesian" })],
  ["manila", estimatedCity({ id: "manila", name: "マニラ", country: "フィリピン", countryCode: "PHL", region: "アジア", currency: "PHP", currencyLabel: "フィリピンペソ", timezone: "UTC+8", climate: "熱帯・高温多湿", language: "フィリピン語・英語", population: "約190万人（市・推計）", taxSystem: "estimate", taxRegion: "philippines", averageAnnualIncome: 600_000, rent: 32_000, costs: { food: 18_000, utilities: 4_500, internet: 2_500, transport: 5_000, medical: 2_500, leisure: 9_000 }, scores: { livability: 68, business: 78, nomad: 84, family: 65, safety: 55, healthcare: 70, internet: 78, transit: 61, nature: 65, japaneseFood: 75, english: 93 }, englishName: "Manila", englishCountry: "Philippines", englishRegion: "Asia", englishClimate: "Tropical, hot and humid", englishLanguage: "Filipino and English" })],
  ["hoChiMinh", estimatedCity({ id: "hoChiMinh", name: "ホーチミン", country: "ベトナム", countryCode: "VNM", region: "アジア", currency: "VND", currencyLabel: "ベトナムドン", timezone: "UTC+7", climate: "熱帯・雨季がある", language: "ベトナム語", population: "約950万人（都市圏・推計）", taxSystem: "estimate", taxRegion: "vietnam", averageAnnualIncome: 180_000_000, rent: 12_000_000, costs: { food: 6_000_000, utilities: 1_500_000, internet: 400_000, transport: 1_500_000, medical: 800_000, leisure: 2_500_000 }, scores: { livability: 74, business: 82, nomad: 90, family: 70, safety: 67, healthcare: 73, internet: 84, transit: 64, nature: 70, japaneseFood: 82, english: 62 }, englishName: "Ho Chi Minh City", englishCountry: "Vietnam", englishRegion: "Asia", englishClimate: "Tropical with a rainy season", englishLanguage: "Vietnamese" })],
  ["beijing", estimatedCity({ id: "beijing", name: "北京", country: "中国", countryCode: "CHN", region: "アジア", currency: "CNY", currencyLabel: "中国元", timezone: "UTC+8", climate: "温帯・乾燥した冬", language: "中国語", population: "約2,200万人（都市圏・推計）", taxSystem: "estimate", taxRegion: "beijing", averageAnnualIncome: 180_000, rent: 8_500, costs: { food: 4_000, utilities: 700, internet: 250, transport: 500, medical: 500, leisure: 1_800 }, scores: { livability: 74, business: 86, nomad: 70, family: 75, safety: 82, healthcare: 78, internet: 58, transit: 94, nature: 62, japaneseFood: 82, english: 38 }, englishName: "Beijing", englishCountry: "China", englishRegion: "Asia", englishClimate: "Temperate, dry winters", englishLanguage: "Mandarin Chinese" })],
  ["shanghai", estimatedCity({ id: "shanghai", name: "上海", country: "中国", countryCode: "CHN", region: "アジア", currency: "CNY", currencyLabel: "中国元", timezone: "UTC+8", climate: "温暖湿潤・四季がある", language: "中国語", population: "約2,500万人（都市圏・推計）", taxSystem: "estimate", taxRegion: "shanghai", averageAnnualIncome: 190_000, rent: 8_000, costs: { food: 4_500, utilities: 700, internet: 250, transport: 500, medical: 500, leisure: 2_000 }, scores: { livability: 76, business: 91, nomad: 72, family: 76, safety: 84, healthcare: 82, internet: 58, transit: 96, nature: 60, japaneseFood: 89, english: 42 }, englishName: "Shanghai", englishCountry: "China", englishRegion: "Asia", englishClimate: "Humid subtropical, four seasons", englishLanguage: "Mandarin Chinese" })],
  ["sydney", estimatedCity({ id: "sydney", name: "シドニー", country: "オーストラリア", countryCode: "AUS", region: "オセアニア", currency: "AUD", currencyLabel: "オーストラリアドル", timezone: "UTC+10（夏時間あり）", climate: "温暖・晴天が多い", language: "英語", population: "約550万人（Greater Sydney・推計）", taxSystem: "australia", taxRegion: "newSouthWales", averageAnnualIncome: 95_000, rent: 3_200, costs: { food: 760, utilities: 240, internet: 90, transport: 220, medical: 120, leisure: 380 }, scores: { livability: 88, business: 89, nomad: 88, family: 87, safety: 82, healthcare: 88, internet: 90, transit: 84, nature: 97, japaneseFood: 88, english: 100 }, englishName: "Sydney", englishCountry: "Australia", englishRegion: "Oceania", englishClimate: "Warm, sunny and coastal", englishLanguage: "English" })],
  ["brisbane", estimatedCity({ id: "brisbane", name: "ブリスベン", country: "オーストラリア", countryCode: "AUS", region: "オセアニア", currency: "AUD", currencyLabel: "オーストラリアドル", timezone: "UTC+10（夏時間あり）", climate: "亜熱帯・温暖", language: "英語", population: "約270万人（Greater Brisbane・推計）", taxSystem: "australia", taxRegion: "queensland", averageAnnualIncome: 85_000, rent: 2_450, costs: { food: 700, utilities: 220, internet: 90, transport: 180, medical: 110, leisure: 330 }, scores: { livability: 89, business: 82, nomad: 84, family: 91, safety: 83, healthcare: 87, internet: 88, transit: 78, nature: 95, japaneseFood: 78, english: 100 }, englishName: "Brisbane", englishCountry: "Australia", englishRegion: "Oceania", englishClimate: "Warm subtropical climate", englishLanguage: "English" })],
  ["perth", estimatedCity({ id: "perth", name: "パース", country: "オーストラリア", countryCode: "AUS", region: "オセアニア", currency: "AUD", currencyLabel: "オーストラリアドル", timezone: "UTC+8", climate: "地中海性・晴天が多い", language: "英語", population: "約230万人（Greater Perth・推計）", taxSystem: "australia", taxRegion: "westernAustralia", averageAnnualIncome: 90_000, rent: 2_350, costs: { food: 700, utilities: 220, internet: 90, transport: 160, medical: 110, leisure: 330 }, scores: { livability: 87, business: 80, nomad: 81, family: 88, safety: 80, healthcare: 86, internet: 87, transit: 72, nature: 96, japaneseFood: 74, english: 100 }, englishName: "Perth", englishCountry: "Australia", englishRegion: "Oceania", englishClimate: "Mediterranean, sunny and dry", englishLanguage: "English" })],
  ["montreal", estimatedCity({ id: "montreal", name: "モントリオール", country: "カナダ", countryCode: "CAN", region: "北米", currency: "CAD", currencyLabel: "カナダドル", timezone: "UTC-5（夏時間あり）", climate: "湿潤大陸性・冬は寒冷", language: "フランス語・英語", population: "約430万人（Metro Montréal・推計）", taxSystem: "canada", taxRegion: "quebec", averageAnnualIncome: 82_000, rent: 1_800, costs: { food: 620, utilities: 130, internet: 85, transport: 100, medical: 70, leisure: 260 }, scores: { livability: 86, business: 82, nomad: 82, family: 87, safety: 78, healthcare: 84, internet: 89, transit: 84, nature: 84, japaneseFood: 76, english: 86 }, englishName: "Montreal", englishCountry: "Canada", englishRegion: "North America", englishClimate: "Humid continental, cold winters", englishLanguage: "French and English" })],
  ["calgary", estimatedCity({ id: "calgary", name: "カルガリー", country: "カナダ", countryCode: "CAN", region: "北米", currency: "CAD", currencyLabel: "カナダドル", timezone: "UTC-7（夏時間あり）", climate: "乾燥した大陸性・冬は寒冷", language: "英語", population: "約160万人（都市圏・推計）", taxSystem: "canada", taxRegion: "alberta", averageAnnualIncome: 88_000, rent: 1_750, costs: { food: 650, utilities: 190, internet: 90, transport: 115, medical: 70, leisure: 280 }, scores: { livability: 87, business: 85, nomad: 80, family: 89, safety: 82, healthcare: 84, internet: 88, transit: 76, nature: 97, japaneseFood: 70, english: 100 }, englishName: "Calgary", englishCountry: "Canada", englishRegion: "North America", englishClimate: "Dry continental, cold winters", englishLanguage: "English" })],
  ["chicago", estimatedCity({ id: "chicago", name: "シカゴ", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-6（夏時間あり）", climate: "湿潤大陸性・四季がある", language: "英語", population: "約270万人（市・推計）", taxSystem: "us", taxRegion: "illinois", averageAnnualIncome: 86_000, rent: 2_200, costs: { food: 650, utilities: 180, internet: 80, transport: 120, medical: 100, leisure: 280 }, scores: { livability: 77, business: 87, nomad: 84, family: 75, safety: 57, healthcare: 86, internet: 91, transit: 88, nature: 67, japaneseFood: 82, english: 100 }, englishName: "Chicago", englishCountry: "United States", englishRegion: "North America", englishClimate: "Humid continental, four seasons", englishLanguage: "English" })],
  ["dallas", estimatedCity({ id: "dallas", name: "ダラス", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-6（夏時間あり）", climate: "温暖・夏は暑い", language: "英語", population: "約130万人（市・推計）", taxSystem: "us", taxRegion: "texas", averageAnnualIncome: 82_000, rent: 1_850, costs: { food: 600, utilities: 200, internet: 80, transport: 230, medical: 100, leisure: 270 }, scores: { livability: 80, business: 90, nomad: 83, family: 82, safety: 64, healthcare: 83, internet: 90, transit: 54, nature: 70, japaneseFood: 78, english: 100 }, englishName: "Dallas", englishCountry: "United States", englishRegion: "North America", englishClimate: "Warm, hot summers", englishLanguage: "English" })],
  ["sanFrancisco", estimatedCity({ id: "sanFrancisco", name: "サンフランシスコ", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-8（夏時間あり）", climate: "地中海性・涼しく乾燥", language: "英語", population: "約81万人（市・推計）", taxSystem: "us", taxRegion: "california", averageAnnualIncome: 125_000, rent: 3_400, costs: { food: 800, utilities: 190, internet: 80, transport: 120, medical: 100, leisure: 350 }, scores: { livability: 80, business: 99, nomad: 95, family: 70, safety: 60, healthcare: 88, internet: 98, transit: 82, nature: 91, japaneseFood: 94, english: 100 }, englishName: "San Francisco", englishCountry: "United States", englishRegion: "North America", englishClimate: "Mediterranean, cool and dry", englishLanguage: "English" })],
  ["miami", estimatedCity({ id: "miami", name: "マイアミ", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-5（夏時間あり）", climate: "熱帯・高温多湿", language: "英語・スペイン語", population: "約46万人（市・推計）", taxSystem: "us", taxRegion: "florida", averageAnnualIncome: 78_000, rent: 2_700, costs: { food: 700, utilities: 210, internet: 80, transport: 220, medical: 100, leisure: 330 }, scores: { livability: 79, business: 84, nomad: 91, family: 75, safety: 62, healthcare: 80, internet: 91, transit: 58, nature: 88, japaneseFood: 74, english: 100 }, englishName: "Miami", englishCountry: "United States", englishRegion: "North America", englishClimate: "Tropical, hot and humid", englishLanguage: "English and Spanish" })],
  ["boston", estimatedCity({ id: "boston", name: "ボストン", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-5（夏時間あり）", climate: "湿潤大陸性・四季がある", language: "英語", population: "約69万人（市・推計）", taxSystem: "us", taxRegion: "massachusetts", averageAnnualIncome: 105_000, rent: 3_000, costs: { food: 720, utilities: 180, internet: 80, transport: 130, medical: 100, leisure: 320 }, scores: { livability: 83, business: 92, nomad: 87, family: 82, safety: 72, healthcare: 95, internet: 93, transit: 88, nature: 74, japaneseFood: 84, english: 100 }, englishName: "Boston", englishCountry: "United States", englishRegion: "North America", englishClimate: "Humid continental, four seasons", englishLanguage: "English" })],
  ["seattle", estimatedCity({ id: "seattle", name: "シアトル", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-8（夏時間あり）", climate: "海洋性・雨が多い", language: "英語", population: "約75万人（市・推計）", taxSystem: "us", taxRegion: "washington", averageAnnualIncome: 110_000, rent: 2_600, costs: { food: 680, utilities: 160, internet: 80, transport: 150, medical: 100, leisure: 300 }, scores: { livability: 86, business: 94, nomad: 91, family: 83, safety: 70, healthcare: 88, internet: 96, transit: 76, nature: 96, japaneseFood: 88, english: 100 }, englishName: "Seattle", englishCountry: "United States", englishRegion: "North America", englishClimate: "Oceanic, rainy and mild", englishLanguage: "English" })],
  ["washingtonDc", estimatedCity({ id: "washingtonDc", name: "ワシントンD.C.", country: "アメリカ", countryCode: "USA", region: "北米", currency: "USD", currencyLabel: "米ドル", timezone: "UTC-5（夏時間あり）", climate: "湿潤亜熱帯・四季がある", language: "英語", population: "約69万人（市・推計）", taxSystem: "us", taxRegion: "districtOfColumbia", averageAnnualIncome: 105_000, rent: 2_700, costs: { food: 720, utilities: 170, internet: 80, transport: 150, medical: 100, leisure: 320 }, scores: { livability: 82, business: 93, nomad: 88, family: 78, safety: 65, healthcare: 90, internet: 94, transit: 88, nature: 76, japaneseFood: 82, english: 100 }, englishName: "Washington, D.C.", englishCountry: "United States", englishRegion: "North America", englishClimate: "Humid subtropical, four seasons", englishLanguage: "English" })],
  ["madrid", estimatedCity({ id: "madrid", name: "マドリード", country: "スペイン", countryCode: "ESP", region: "ヨーロッパ", currency: "EUR", currencyLabel: "ユーロ", timezone: "UTC+1（夏時間あり）", climate: "地中海性・乾燥した夏", language: "スペイン語", population: "約340万人（市・推計）", taxSystem: "estimate", taxRegion: "spain", averageAnnualIncome: 34_000, rent: 1_200, costs: { food: 300, utilities: 150, internet: 35, transport: 55, medical: 40, leisure: 180 }, scores: { livability: 87, business: 78, nomad: 90, family: 88, safety: 82, healthcare: 90, internet: 91, transit: 93, nature: 78, japaneseFood: 70, english: 62 }, englishName: "Madrid", englishCountry: "Spain", englishRegion: "Europe", englishClimate: "Mediterranean, dry summers", englishLanguage: "Spanish" })],
  ["berlin", estimatedCity({ id: "berlin", name: "ベルリン", country: "ドイツ", countryCode: "DEU", region: "ヨーロッパ", currency: "EUR", currencyLabel: "ユーロ", timezone: "UTC+1（夏時間あり）", climate: "海洋性・冬は寒冷", language: "ドイツ語", population: "約370万人（市・推計）", taxSystem: "estimate", taxRegion: "germany", averageAnnualIncome: 52_000, rent: 1_500, costs: { food: 380, utilities: 220, internet: 45, transport: 60, medical: 50, leisure: 230 }, scores: { livability: 85, business: 88, nomad: 93, family: 82, safety: 76, healthcare: 91, internet: 88, transit: 91, nature: 82, japaneseFood: 78, english: 88 }, englishName: "Berlin", englishCountry: "Germany", englishRegion: "Europe", englishClimate: "Oceanic, cool winters", englishLanguage: "German" })],
  ["amsterdam", estimatedCity({ id: "amsterdam", name: "アムステルダム", country: "オランダ", countryCode: "NLD", region: "ヨーロッパ", currency: "EUR", currencyLabel: "ユーロ", timezone: "UTC+1（夏時間あり）", climate: "海洋性・雨が多い", language: "オランダ語・英語", population: "約93万人（市・推計）", taxSystem: "estimate", taxRegion: "netherlands", averageAnnualIncome: 58_000, rent: 1_900, costs: { food: 420, utilities: 230, internet: 50, transport: 110, medical: 140, leisure: 250 }, scores: { livability: 87, business: 91, nomad: 94, family: 83, safety: 80, healthcare: 89, internet: 95, transit: 92, nature: 83, japaneseFood: 80, english: 98 }, englishName: "Amsterdam", englishCountry: "Netherlands", englishRegion: "Europe", englishClimate: "Oceanic, rainy and mild", englishLanguage: "Dutch and English" })],
  ["lisbon", estimatedCity({ id: "lisbon", name: "リスボン", country: "ポルトガル", countryCode: "PRT", region: "ヨーロッパ", currency: "EUR", currencyLabel: "ユーロ", timezone: "UTC+0（夏時間あり）", climate: "地中海性・温暖", language: "ポルトガル語", population: "約55万人（市・推計）", taxSystem: "estimate", taxRegion: "portugal", averageAnnualIncome: 28_000, rent: 1_300, costs: { food: 300, utilities: 150, internet: 40, transport: 50, medical: 40, leisure: 180 }, scores: { livability: 86, business: 76, nomad: 95, family: 84, safety: 82, healthcare: 86, internet: 90, transit: 83, nature: 87, japaneseFood: 65, english: 84 }, englishName: "Lisbon", englishCountry: "Portugal", englishRegion: "Europe", englishClimate: "Mediterranean, mild and sunny", englishLanguage: "Portuguese" })],
  ["dubai", estimatedCity({ id: "dubai", name: "ドバイ", country: "アラブ首長国連邦", countryCode: "ARE", region: "中東", currency: "AED", currencyLabel: "UAEディルハム", timezone: "UTC+4", climate: "砂漠性・非常に暑い", language: "アラビア語・英語", population: "約370万人（市・推計）", taxSystem: "estimate", taxRegion: "uae", averageAnnualIncome: 240_000, rent: 8_000, costs: { food: 2_500, utilities: 900, internet: 400, transport: 1_200, medical: 600, leisure: 1_500 }, scores: { livability: 82, business: 98, nomad: 95, family: 76, safety: 92, healthcare: 87, internet: 94, transit: 76, nature: 58, japaneseFood: 85, english: 96 }, englishName: "Dubai", englishCountry: "United Arab Emirates", englishRegion: "Middle East", englishClimate: "Desert, extremely hot summers", englishLanguage: "Arabic and English" })],
  ["zurich", estimatedCity({ id: "zurich", name: "チューリッヒ", country: "スイス", countryCode: "CHE", region: "ヨーロッパ", currency: "CHF", currencyLabel: "スイスフラン", timezone: "UTC+1（夏時間あり）", climate: "温帯・四季がある", language: "ドイツ語・英語", population: "約43万人（市・推計）", taxSystem: "estimate", taxRegion: "zurich", averageAnnualIncome: 105_000, rent: 2_600, costs: { food: 850, utilities: 220, internet: 65, transport: 100, medical: 350, leisure: 450 }, scores: { livability: 92, business: 90, nomad: 82, family: 91, safety: 93, healthcare: 97, internet: 94, transit: 94, nature: 95, japaneseFood: 72, english: 90 }, englishName: "Zurich", englishCountry: "Switzerland", englishRegion: "Europe", englishClimate: "Temperate, four seasons", englishLanguage: "German and English" })],
  ["dublin", estimatedCity({ id: "dublin", name: "ダブリン", country: "アイルランド", countryCode: "IRL", region: "ヨーロッパ", currency: "EUR", currencyLabel: "ユーロ", timezone: "UTC+0（夏時間あり）", climate: "海洋性・雨が多い", language: "英語・アイルランド語", population: "約145万人（都市圏・推計）", taxSystem: "estimate", taxRegion: "ireland", averageAnnualIncome: 65_000, rent: 2_100, costs: { food: 500, utilities: 220, internet: 55, transport: 130, medical: 80, leisure: 280 }, scores: { livability: 83, business: 94, nomad: 91, family: 78, safety: 76, healthcare: 84, internet: 94, transit: 80, nature: 91, japaneseFood: 72, english: 100 }, englishName: "Dublin", englishCountry: "Ireland", englishRegion: "Europe", englishClimate: "Oceanic, rainy and mild", englishLanguage: "English and Irish" })],
  ["saoPaulo", estimatedCity({ id: "saoPaulo", name: "サンパウロ", country: "ブラジル", countryCode: "BRA", region: "南米", currency: "BRL", currencyLabel: "ブラジルレアル", timezone: "UTC-3", climate: "亜熱帯・雨季がある", language: "ポルトガル語", population: "約1,140万人（市・推計）", taxSystem: "estimate", taxRegion: "brazil", averageAnnualIncome: 90_000, rent: 3_000, costs: { food: 1_800, utilities: 450, internet: 180, transport: 300, medical: 350, leisure: 800 }, scores: { livability: 68, business: 82, nomad: 78, family: 66, safety: 48, healthcare: 70, internet: 80, transit: 74, nature: 68, japaneseFood: 76, english: 42 }, englishName: "São Paulo", englishCountry: "Brazil", englishRegion: "South America", englishClimate: "Subtropical with a rainy season", englishLanguage: "Portuguese" })],
  ["buenosAires", estimatedCity({ id: "buenosAires", name: "ブエノスアイレス", country: "アルゼンチン", countryCode: "ARG", region: "南米", currency: "ARS", currencyLabel: "アルゼンチンペソ", timezone: "UTC-3", climate: "温暖湿潤・四季がある", language: "スペイン語", population: "約310万人（市・推計）", taxSystem: "estimate", taxRegion: "argentina", averageAnnualIncome: 12_000_000, rent: 700_000, costs: { food: 500_000, utilities: 90_000, internet: 40_000, transport: 60_000, medical: 70_000, leisure: 180_000 }, scores: { livability: 76, business: 72, nomad: 87, family: 76, safety: 55, healthcare: 74, internet: 82, transit: 84, nature: 72, japaneseFood: 64, english: 48 }, englishName: "Buenos Aires", englishCountry: "Argentina", englishRegion: "South America", englishClimate: "Temperate, four seasons", englishLanguage: "Spanish" })],
  ["santiago", estimatedCity({ id: "santiago", name: "サンティアゴ", country: "チリ", countryCode: "CHL", region: "南米", currency: "CLP", currencyLabel: "チリペソ", timezone: "UTC-4（夏時間あり）", climate: "地中海性・乾燥", language: "スペイン語", population: "約620万人（都市圏・推計）", taxSystem: "estimate", taxRegion: "chile", averageAnnualIncome: 18_000_000, rent: 650_000, costs: { food: 450_000, utilities: 100_000, internet: 35_000, transport: 50_000, medical: 80_000, leisure: 160_000 }, scores: { livability: 78, business: 80, nomad: 82, family: 79, safety: 64, healthcare: 78, internet: 86, transit: 84, nature: 93, japaneseFood: 68, english: 50 }, englishName: "Santiago", englishCountry: "Chile", englishRegion: "South America", englishClimate: "Mediterranean, dry summers", englishLanguage: "Spanish" })],
  ["bogota", estimatedCity({ id: "bogota", name: "ボゴタ", country: "コロンビア", countryCode: "COL", region: "南米", currency: "COP", currencyLabel: "コロンビアペソ", timezone: "UTC-5", climate: "高地・温和", language: "スペイン語", population: "約800万人（市・推計）", taxSystem: "estimate", taxRegion: "colombia", averageAnnualIncome: 60_000_000, rent: 2_500_000, costs: { food: 1_500_000, utilities: 350_000, internet: 140_000, transport: 250_000, medical: 300_000, leisure: 700_000 }, scores: { livability: 70, business: 76, nomad: 80, family: 66, safety: 52, healthcare: 70, internet: 82, transit: 73, nature: 78, japaneseFood: 60, english: 42 }, englishName: "Bogotá", englishCountry: "Colombia", englishRegion: "South America", englishClimate: "Highland, mild year-round", englishLanguage: "Spanish" })],
] as Array<[CityId, City]>) as Record<CityId, City>;

const cities: Record<CityId, City> = { ...(baseCities as Record<CityId, City>), ...extendedCities };
const cityOrder: CityId[] = ["tokyo", "osaka", "vancouver", "toronto", "losAngeles", "newYork", "london", "paris", "rome", "queretaro", "puebla", "merida", "mexicoCity", "melbourne", "sapporo", "fukuoka", "seoul", "taipei", "singapore", "hongKong", "bangkok", "kualaLumpur", "jakarta", "manila", "hoChiMinh", "beijing", "shanghai", "sydney", "brisbane", "perth", "montreal", "calgary", "chicago", "dallas", "sanFrancisco", "miami", "boston", "seattle", "washingtonDc", "madrid", "berlin", "amsterdam", "lisbon", "dubai", "zurich", "dublin", "saoPaulo", "buenosAires", "santiago", "bogota"];
const householdMultipliers = {
  single: 1,
  couple: 1.55,
  singleParent: 1.42,
  coupleOneChild: 1.8,
  family: 2.05,
  familyThreeChildren: 2.45,
} as const;
const housingMultipliers = {
  shared: 0.58,
  studio: 0.8,
  onebed: 1,
  condo: 1.15,
  twobed: 1.55,
  house: 2.05,
} as const;
const lifestyleMultipliers = { lean: 0.8, balanced: 1, comfortable: 1.25 };

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
    household: "世帯",
    housing: "住居",
    lifestyle: "生活スタイル",
    ageBand: "年齢区分（保険料）",
    ageHint: "日本の介護保険料に反映",
    compare: "比較結果を見る",
    reset: "条件を初期化",
    assumption: "税金・社会保険は「現地の居住者・給与所得のみ・標準的な就労者」を基準にした比較用試算です。世帯区分は生活費と、米国の医療保険加入者負担の目安に反映します。扶養控除や児童手当などは国ごとの差が大きいため、この版では含めていません。",
    resultEyebrow: "02 / 結果のサマリー",
    resultTitle: "毎月、どれくらい残る？",
    dataLoading: "公的データを確認中…",
    dataLive: "人口・為替を公的データから取得",
    dataPartial: "公的データの一部のみ取得",
    update: "公式データを更新",
    updating: "更新中",
    fallback: "保存値を表示しています。",
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
    currentScenario: "現在地の試算",
    sameYenScenario: "同じ円価値の給与で試算",
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
    dataLiveMethod: "人口・為替を公的データから取得",
    dataFallbackMethod: "保存した参考値",
    retrievedAt: "取得時刻：",
    cityCosts: "都市別の家賃・給与",
    cityCostsStrong: "公式統計の範囲を明示",
    cityCostsText: "給与は都道府県・州・国、物価は都市のCPIなど、実際に公表されている地域の範囲を明示します。広告や民間ランキングを公式値として扱いません。",
    taxes: "税金・保険料",
    taxesStrong: "都市の制度に合わせて計算",
    taxesText: "日本、カナダ、米国、英国、フランス、イタリア、メキシコ、豪州について、所得税と社会保険を分けて試算します。米国の医療保険はKFFの加入者負担平均を推定値として加えています。",
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
    household: "Household",
    housing: "Housing",
    lifestyle: "Lifestyle",
    ageBand: "Age band (insurance)",
    ageHint: "Applied to Japan's long-term care insurance",
    compare: "See comparison",
    reset: "Reset conditions",
    assumption: "Taxes and social insurance are comparison estimates for a local employee with salary income. Household size affects living costs and the U.S. employee health insurance estimate. Country-specific dependent deductions and child benefits are not included in this version.",
    resultEyebrow: "02 / SUMMARY",
    resultTitle: "How much remains each month?",
    dataLoading: "Checking public data…",
    dataLive: "Population and FX from public data",
    dataPartial: "Some public data only",
    update: "Refresh public data",
    updating: "Updating",
    fallback: "Showing saved reference values.",
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
    currentScenario: "Origin scenario",
    sameYenScenario: "Same yen-value salary",
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
    dataLiveMethod: "Population and FX retrieved from public data",
    dataFallbackMethod: "Saved reference values",
    retrievedAt: "Retrieved: ",
    cityCosts: "City rent and salary",
    cityCostsStrong: "Public-data coverage is shown",
    cityCostsText: "Salary data is shown at the prefecture, state or national level, while prices use published city or CPI data where available. Advertising and private rankings are not presented as official values.",
    taxes: "Taxes and insurance",
    taxesStrong: "Calculated for each city's system",
    taxesText: "Income tax and social insurance are estimated separately for Japan, Canada, the U.S., the U.K., France, Italy, Mexico and Australia. U.S. health insurance uses an estimated employee contribution average from KFF.",
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
  const labels: Record<string, string> = { "人口": "Population", "物価": "Prices", "物価・家賃": "Prices and rent", "給与": "Salary", "所得税": "Income tax", "連邦・州所得税": "Federal and provincial tax", "連邦所得税": "Federal income tax", "州税・市税": "State and city tax", "社会保障・Medicare": "Social Security and Medicare", "医療保険": "Health insurance", "健康保険・介護保険": "Health and long-term care insurance", "CPP・EI": "CPP and EI", "国民保険": "National Insurance", "社会保険": "Social insurance", "年金": "Pension", "退職積立": "Superannuation", "所得税・Medicare levy": "Income tax and Medicare levy" };
  return labels[item] ?? item;
};
const sourceLevel = (level: DataSource["level"], language: Language) => {
  if (language === "ja") return level;
  const labels: Record<DataSource["level"], string> = { 都市: "City", 都道府県: "Prefecture", 州: "State", 国: "Country", "国・州": "Country / state", "州・市": "State / city", 都市圏: "Metro area", 自治体: "Municipality" };
  return labels[level];
};
const sourceScope = (scope: string, language: Language) => {
  if (language === "ja") return scope;
  const labels: Record<string, string> = { "各国の人口": "Population by country", "各通貨を日本円へ換算するための為替": "FX rates used to convert currencies to JPY" };
  return labels[scope] ?? scope;
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

type TaxSlice = { limit: number; rate: number };

function progressiveTax(income: number, slices: TaxSlice[]) {
  let previousLimit = 0;
  let total = 0;
  for (const slice of slices) {
    const taxableInSlice = Math.max(0, Math.min(income, slice.limit) - previousLimit);
    total += taxableInSlice * slice.rate;
    previousLimit = slice.limit;
    if (income <= slice.limit) break;
  }
  return total;
}

function japaneseSalaryDeduction(grossAnnual: number) {
  if (grossAnnual <= 740_000) return grossAnnual;
  if (grossAnnual <= 2_190_000) return 740_000;
  if (grossAnnual < 2_193_000) return grossAnnual - 1_451_000;
  if (grossAnnual < 2_196_000) return grossAnnual - 1_453_000;
  if (grossAnnual < 2_200_000) return grossAnnual - 1_456_000;
  if (grossAnnual <= 3_600_000) return grossAnnual * 0.3 + 80_000;
  if (grossAnnual <= 6_600_000) return grossAnnual * 0.2 + 440_000;
  if (grossAnnual <= 8_500_000) return grossAnnual * 0.1 + 1_100_000;
  return 1_950_000;
}

function japaneseBasicDeduction(grossAnnual: number) {
  if (grossAnnual <= 2_060_000) return 1_040_000;
  if (grossAnnual <= 4_751_999) return 620_000;
  if (grossAnnual <= 6_655_556) return 680_000;
  if (grossAnnual <= 8_500_000) return 670_000;
  if (grossAnnual <= 25_450_000) return 620_000;
  return 0;
}

function calculateJapanInsurance(city: City, grossAnnual: number, ageBand: AgeBand) {
  const insurance = city.insurance;
  const healthInsurance = grossAnnual * insurance.healthRateEmployee;
  const childSupport = grossAnnual * insurance.childSupportRateEmployee;
  const careInsurance = ageBand === "40to64" ? grossAnnual * insurance.careRateEmployee : 0;
  const pension = grossAnnual * insurance.pensionRateEmployee;
  const employment = grossAnnual * insurance.employmentRateEmployee;
  return { healthInsurance, childSupport, careInsurance, pension, employment };
}

function emptyTaxBreakdown() {
  return {
    incomeTaxMonthly: 0, reconstructionSurtaxMonthly: 0, residentTaxMonthly: 0, medicareLevyMonthly: 0,
    healthInsuranceMonthly: 0, careInsuranceMonthly: 0, childSupportMonthly: 0, pensionMonthly: 0,
    employmentInsuranceMonthly: 0, totalTaxMonthly: 0, totalInsuranceMonthly: 0, totalDeductionsMonthly: 0,
    employerSuperMonthly: 0,
  };
}

function taxFromAnnualBrackets(income: number, brackets: TaxSlice[]) {
  return progressiveTax(Math.max(0, income), brackets);
}

function taxFromFixedTariff(income: number, tariffs: Array<{ lower: number; upper: number; fixed: number; rate: number }>) {
  const target = Math.max(0, income);
  const tariff = tariffs.find((item) => target <= item.upper) ?? tariffs[tariffs.length - 1];
  return tariff.fixed + Math.max(0, target - tariff.lower) * tariff.rate;
}

function calculateCanadaPension(grossAnnual: number, insurance: InsuranceConfig) {
  const base = Math.min(Math.max(0, grossAnnual - (insurance.pensionBaseExemption ?? 3_500)) * (insurance.pensionRateEmployee || 0.0595), insurance.pensionAnnualMax ?? 4_230.45);
  const second = Math.min(Math.max(0, grossAnnual - (insurance.pensionSecondStart ?? 74_600)), (insurance.pensionSecondCap ?? 85_000) - (insurance.pensionSecondStart ?? 74_600)) * (insurance.pensionSecondRateEmployee ?? 0.04);
  return Math.min(base, insurance.pensionAnnualMax ?? 4_230.45) + Math.min(second, insurance.pensionSecondAnnualMax ?? 416);
}

function calculateOntarioHealthPremium(taxableIncome: number) {
  if (taxableIncome <= 20_000) return 0;
  if (taxableIncome <= 36_000) return Math.min(300, (taxableIncome - 20_000) * 0.06);
  if (taxableIncome <= 48_000) return Math.min(450, 300 + (taxableIncome - 36_000) * 0.06);
  if (taxableIncome <= 72_000) return Math.min(600, 450 + (taxableIncome - 48_000) * 0.25);
  if (taxableIncome <= 200_000) return Math.min(750, 600 + (taxableIncome - 72_000) * 0.25);
  return Math.min(900, 750 + (taxableIncome - 200_000) * 0.25);
}

function calculateCanadaTax(city: City, grossAnnual: number) {
  const federalTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 16_452), [
    { limit: 58_523, rate: 0.14 }, { limit: 117_045, rate: 0.205 }, { limit: 181_440, rate: 0.26 }, { limit: 258_482, rate: 0.29 }, { limit: Number.POSITIVE_INFINITY, rate: 0.33 },
  ]);
  if (city.taxRegion === "britishColumbia") {
    const provincialTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 13_000), [
      { limit: 50_363, rate: 0.056 }, { limit: 100_728, rate: 0.077 }, { limit: 115_648, rate: 0.105 }, { limit: 140_430, rate: 0.1229 }, { limit: 190_405, rate: 0.147 }, { limit: 265_545, rate: 0.168 }, { limit: Number.POSITIVE_INFINITY, rate: 0.205 },
    ]);
    return { federalTax, provincialTax, healthPremium: 0 };
  }
  const taxable = Math.max(0, grossAnnual - 12_989);
  const provincialTaxBeforeSurtax = taxFromAnnualBrackets(taxable, [
    { limit: 53_891, rate: 0.0505 }, { limit: 107_785, rate: 0.0915 }, { limit: 150_000, rate: 0.1116 }, { limit: 220_000, rate: 0.1216 }, { limit: Number.POSITIVE_INFINITY, rate: 0.1316 },
  ]);
  const surtax = provincialTaxBeforeSurtax <= 5_818 ? 0 : (provincialTaxBeforeSurtax <= 7_446 ? (provincialTaxBeforeSurtax - 5_818) * 0.2 : (provincialTaxBeforeSurtax - 5_818) * 0.2 + (provincialTaxBeforeSurtax - 7_446) * 0.36);
  return { federalTax, provincialTax: provincialTaxBeforeSurtax + surtax, healthPremium: calculateOntarioHealthPremium(Math.max(0, grossAnnual - 12_989)) };
}

function calculateUsIncomeTax(city: City, grossAnnual: number) {
  const federalTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 16_100), [
    { limit: 12_400, rate: 0.1 }, { limit: 50_400, rate: 0.12 }, { limit: 105_700, rate: 0.22 }, { limit: 201_775, rate: 0.24 }, { limit: 256_225, rate: 0.32 }, { limit: 640_600, rate: 0.35 }, { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
  ]);
  if (city.taxRegion === "california") {
    return federalTax + taxFromAnnualBrackets(Math.max(0, grossAnnual - 5_706), [
      { limit: 11_079, rate: 0.01 }, { limit: 26_264, rate: 0.02 }, { limit: 41_452, rate: 0.04 }, { limit: 57_542, rate: 0.06 }, { limit: 72_724, rate: 0.08 }, { limit: 371_479, rate: 0.093 }, { limit: 445_771, rate: 0.103 }, { limit: 742_953, rate: 0.113 }, { limit: Number.POSITIVE_INFINITY, rate: 0.123 },
    ]);
  }
  if (city.taxRegion === "newYork") {
    const taxable = Math.max(0, grossAnnual - 8_000);
    const stateTax = taxFromAnnualBrackets(taxable, [
      { limit: 8_500, rate: 0.039 }, { limit: 11_700, rate: 0.044 }, { limit: 13_900, rate: 0.0515 }, { limit: 80_650, rate: 0.054 }, { limit: 215_400, rate: 0.059 }, { limit: 1_077_550, rate: 0.0685 }, { limit: 5_000_000, rate: 0.0965 }, { limit: 25_000_000, rate: 0.103 }, { limit: Number.POSITIVE_INFINITY, rate: 0.109 },
    ]);
    const cityTax = taxFromAnnualBrackets(Math.max(0, grossAnnual - 8_000), [
      { limit: 12_000, rate: 0.03078 }, { limit: 25_000, rate: 0.03762 }, { limit: 50_000, rate: 0.03819 }, { limit: Number.POSITIVE_INFINITY, rate: 0.03876 },
    ]);
    return federalTax + stateTax + cityTax;
  }
  return federalTax;
}

function estimateTaxBreakdown(city: City, grossAnnual: number, ageBand: AgeBand, household: keyof typeof householdMultipliers) {
  if (city.taxSystem === "japan") {
    const insurance = calculateJapanInsurance(city, grossAnnual, ageBand);
    const totalInsurance = insurance.healthInsurance + insurance.childSupport + insurance.careInsurance + insurance.pension + insurance.employment;
    const salaryIncome = Math.max(0, grossAnnual - japaneseSalaryDeduction(grossAnnual));
    const taxableIncome = Math.floor(Math.max(0, salaryIncome - japaneseBasicDeduction(grossAnnual) - totalInsurance) / 1_000) * 1_000;
    const nationalTax = progressiveTax(taxableIncome, [
      { limit: 1_950_000, rate: 0.05 },
      { limit: 3_300_000, rate: 0.1 },
      { limit: 6_950_000, rate: 0.2 },
      { limit: 9_000_000, rate: 0.23 },
      { limit: 18_000_000, rate: 0.33 },
      { limit: 40_000_000, rate: 0.4 },
      { limit: Number.POSITIVE_INFINITY, rate: 0.45 },
    ]);
    const reconstructionSurtax = nationalTax * 0.021;
    const residentTaxBase = Math.max(0, salaryIncome - 430_000 - totalInsurance);
    const residentTax = residentTaxBase * 0.1 + 5_000;
    const totalTax = nationalTax + reconstructionSurtax + residentTax;
    return {
      incomeTaxMonthly: nationalTax / 12,
      reconstructionSurtaxMonthly: reconstructionSurtax / 12,
      residentTaxMonthly: residentTax / 12,
      medicareLevyMonthly: 0,
      healthInsuranceMonthly: insurance.healthInsurance / 12,
      careInsuranceMonthly: insurance.careInsurance / 12,
      childSupportMonthly: insurance.childSupport / 12,
      pensionMonthly: insurance.pension / 12,
      employmentInsuranceMonthly: insurance.employment / 12,
      totalTaxMonthly: totalTax / 12,
      totalInsuranceMonthly: totalInsurance / 12,
      totalDeductionsMonthly: (totalTax + totalInsurance) / 12,
      employerSuperMonthly: 0,
    };
  }
  if (city.taxSystem === "canada") {
    const tax = calculateCanadaTax(city, grossAnnual);
    const pension = calculateCanadaPension(grossAnnual, city.insurance);
    const employment = Math.min(grossAnnual * city.insurance.employmentRateEmployee, city.insurance.employmentCap ?? 1_123.07);
    const totalTax = tax.federalTax + tax.provincialTax;
    const totalInsurance = pension + employment + tax.healthPremium;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: totalTax / 12, healthInsuranceMonthly: tax.healthPremium / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "us") {
    const incomeTax = calculateUsIncomeTax(city, grossAnnual);
    const socialSecurity = Math.min(grossAnnual, city.insurance.socialSecurityWageBase ?? 184_500) * city.insurance.socialSecurityRateEmployee;
    const medicare = grossAnnual * city.insurance.medicareRate + Math.max(0, grossAnnual - (city.insurance.additionalMedicareThreshold ?? 200_000)) * (city.insurance.additionalMedicareRate ?? 0);
    const health = household === "single" ? city.insurance.healthInsuranceEmployeeMonthly * 12 : city.insurance.healthInsuranceFamilyMonthly * 12;
    const totalTax = incomeTax + medicare;
    const totalInsurance = socialSecurity + health;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicare / 12, healthInsuranceMonthly: health / 12, pensionMonthly: socialSecurity / 12, totalTaxMonthly: totalTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (totalTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "uk") {
    const allowance = grossAnnual > 100_000 ? Math.max(0, 12_570 - (grossAnnual - 100_000) / 2) : 12_570;
    const taxableIncome = Math.max(0, grossAnnual - allowance);
    const incomeTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 37_700, rate: 0.2 }, { limit: 125_140 - 12_570, rate: 0.4 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
    const ni = Math.max(0, Math.min(grossAnnual, 50_270) - 12_570) * 0.08 + Math.max(0, grossAnnual - 50_270) * 0.02;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, employmentInsuranceMonthly: ni / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: ni / 12, totalDeductionsMonthly: (incomeTax + ni) / 12 };
  }
  if (city.taxSystem === "france") {
    const socialBase = grossAnnual;
    const health = socialBase * city.insurance.healthRateEmployee;
    const pension = socialBase * city.insurance.pensionRateEmployee;
    const employment = socialBase * city.insurance.employmentRateEmployee;
    const taxableIncome = socialBase * 0.9;
    const incomeTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 11_600, rate: 0 }, { limit: 29_579, rate: 0.11 }, { limit: 84_577, rate: 0.3 }, { limit: 181_917, rate: 0.41 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
    const totalInsurance = health + pension + employment;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "italy") {
    const pension = grossAnnual * city.insurance.pensionRateEmployee + Math.min(Math.max(0, grossAnnual - 56_224), 66_071) * 0.01;
    const taxableIncome = Math.max(0, grossAnnual - pension);
    const nationalTax = taxFromAnnualBrackets(taxableIncome, [{ limit: 15_000, rate: 0.23 }, { limit: 28_000, rate: 0.33 }, { limit: Number.POSITIVE_INFINITY, rate: 0.43 }]);
    const localTax = taxableIncome * 0.0263;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: nationalTax / 12, residentTaxMonthly: localTax / 12, pensionMonthly: pension / 12, totalTaxMonthly: (nationalTax + localTax) / 12, totalInsuranceMonthly: pension / 12, totalDeductionsMonthly: (nationalTax + localTax + pension) / 12 };
  }
  if (city.taxSystem === "mexico") {
    const incomeTax = taxFromFixedTariff(grossAnnual, [
      { lower: 0.01, upper: 10_135.11, fixed: 0, rate: 0.0192 }, { lower: 10_135.12, upper: 86_022.11, fixed: 194.59, rate: 0.064 }, { lower: 86_022.12, upper: 151_176.19, fixed: 5_051.37, rate: 0.1088 }, { lower: 151_176.20, upper: 175_735.66, fixed: 12_140.13, rate: 0.16 }, { lower: 175_735.67, upper: 210_403.69, fixed: 16_069.64, rate: 0.1792 }, { lower: 210_403.70, upper: 424_353.97, fixed: 22_282.14, rate: 0.2136 }, { lower: 424_353.98, upper: 668_840.14, fixed: 67_981.92, rate: 0.2352 }, { lower: 668_840.15, upper: 1_276_925.98, fixed: 125_485.07, rate: 0.3 }, { lower: 1_276_925.99, upper: 1_702_567.97, fixed: 307_910.81, rate: 0.32 }, { lower: 1_702_567.98, upper: 5_107_703.92, fixed: 444_116.23, rate: 0.34 }, { lower: 5_107_703.93, upper: Number.POSITIVE_INFINITY, fixed: 1_601_862.46, rate: 0.35 },
    ]);
    const health = grossAnnual * city.insurance.healthRateEmployee;
    const pension = grossAnnual * city.insurance.pensionRateEmployee;
    const totalInsurance = health + pension;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  if (city.taxSystem === "estimate") {
    const incomeTax = grossAnnual * 0.2;
    const health = grossAnnual * city.insurance.healthRateEmployee;
    const pension = grossAnnual * city.insurance.pensionRateEmployee;
    const employment = grossAnnual * city.insurance.employmentRateEmployee;
    const totalInsurance = health + pension + employment;
    return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, healthInsuranceMonthly: health / 12, pensionMonthly: pension / 12, employmentInsuranceMonthly: employment / 12, totalTaxMonthly: incomeTax / 12, totalInsuranceMonthly: totalInsurance / 12, totalDeductionsMonthly: (incomeTax + totalInsurance) / 12 };
  }
  const incomeTax = taxFromAnnualBrackets(grossAnnual, [{ limit: 18_200, rate: 0 }, { limit: 45_000, rate: 0.15 }, { limit: 135_000, rate: 0.3 }, { limit: 190_000, rate: 0.37 }, { limit: Number.POSITIVE_INFINITY, rate: 0.45 }]);
  const medicareLevy = grossAnnual * city.insurance.medicareRate;
  return { ...emptyTaxBreakdown(), incomeTaxMonthly: incomeTax / 12, medicareLevyMonthly: medicareLevy / 12, totalTaxMonthly: (incomeTax + medicareLevy) / 12, totalDeductionsMonthly: (incomeTax + medicareLevy) / 12, employerSuperMonthly: grossAnnual * city.insurance.employerSuperRate / 12 };
}

function calculateCity(city: City, grossAnnual: number, household: keyof typeof householdMultipliers, housing: keyof typeof housingMultipliers, lifestyle: keyof typeof lifestyleMultipliers, ageBand: AgeBand): CityResult {
  const householdMultiplier = householdMultipliers[household];
  const housingMultiplier = housingMultipliers[housing];
  const lifestyleMultiplier = lifestyleMultipliers[lifestyle];
  const grossMonthly = grossAnnual / 12;
  const taxBreakdown = estimateTaxBreakdown(city, grossAnnual, ageBand, household);
  const taxMonthly = taxBreakdown.totalDeductionsMonthly;
  const netMonthly = grossMonthly - taxMonthly;
  const rent = city.costs.rent * housingMultiplier;
  const livingCosts = (city.costs.food + city.costs.utilities + city.costs.internet + city.costs.transport + city.costs.medical + city.costs.leisure) * householdMultiplier * lifestyleMultiplier;
  const totalMonthlyCosts = rent + livingCosts;
  const monthlyRemaining = netMonthly - totalMonthlyCosts;
  const annualSavings = Math.max(monthlyRemaining, 0) * 12;
  const rentBurden = netMonthly > 0 ? (rent / netMonthly) * 100 : 100;
  const costIndex = Math.round((totalMonthlyCosts / (city.averageAnnualIncome / 12)) * 1000) / 10;
  const purchasingPower = netMonthly > 0 ? Math.round((netMonthly / totalMonthlyCosts) * 100) : 0;
  const savings = clamp((monthlyRemaining / Math.max(netMonthly * 0.4, 1)) * 100);
  const fire = clamp(savings * 0.55 + clamp(200 - costIndex, 0, 100) * 0.25 + city.scores.safety * 0.2);
  const overall = Math.round(city.scores.livability * 0.2 + savings * 0.2 + city.scores.business * 0.15 + fire * 0.15 + city.scores.nomad * 0.1 + city.scores.family * 0.2);
  return {
    city,
    grossAnnual,
    grossMonthly,
    taxMonthly,
    netMonthly,
    rent,
    livingCosts,
    totalMonthlyCosts,
    monthlyRemaining,
    annualSavings,
    rentBurden,
    costIndex,
    purchasingPower,
    taxBreakdown,
    scores: {
      livability: city.scores.livability,
      savings: Math.round(savings),
      business: city.scores.business,
      fire: Math.round(fire),
      nomad: city.scores.nomad,
      family: city.scores.family,
      overall,
    },
  };
}

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
  const [supabaseConfigured, setSupabaseConfigured] = useState(() => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
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

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const loadCloudHistory = useCallback(async () => {
    if (!supabaseConfigured) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setHistory(Array.isArray(data.history) ? data.history.filter(isHistoryRecord).slice(0, LOCAL_HISTORY_LIMIT) : []);
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
  const destinationGross = origin.fxToJpy === destination.fxToJpy ? grossOrigin : (grossOrigin * origin.fxToJpy) / destination.fxToJpy;

  const results = useMemo(() => ({
    origin: calculateCity(origin, grossOrigin, household, housing, lifestyle, ageBand),
    destination: calculateCity(destination, destinationGross, household, housing, lifestyle, ageBand),
  }), [origin, destination, grossOrigin, destinationGross, household, housing, lifestyle, ageBand]);

  const recommendations = useMemo(() => {
    const candidates = globalBusinessProfiles.map((profile) => {
      const candidateBase = cities[profile.cityId];
      const city = { ...candidateBase, fxToJpy: fxToJpy(candidateBase.currency) };
      const candidateGross = origin.fxToJpy === city.fxToJpy ? grossOrigin : (grossOrigin * origin.fxToJpy) / city.fxToJpy;
      const result = calculateCity(city, candidateGross, household, housing, lifestyle, ageBand);
      return { profile, result, remainingJpy: result.monthlyRemaining * city.fxToJpy };
    });
    const remainingValues = candidates.map((candidate) => candidate.remainingJpy);
    const minRemaining = Math.min(...remainingValues);
    const maxRemaining = Math.max(...remainingValues);
    const businessValues = candidates.map((candidate) => candidate.profile.score);
    const livabilityValues = candidates.map((candidate) => candidate.result.scores.livability);
    const normalize = (value: number, min: number, max: number) => clamp(((value - min) / Math.max(max - min, 1)) * 100);
    const weights = recommendationWeights[recommendationPriority];

    return candidates.map((candidate) => {
      const moneyScore = normalize(candidate.remainingJpy, minRemaining, maxRemaining);
      const businessScore = normalize(candidate.profile.score, Math.min(...businessValues), Math.max(...businessValues));
      const livabilityScore = normalize(candidate.result.scores.livability, Math.min(...livabilityValues), Math.max(...livabilityValues));
      const factors = {
        money: moneyScore * weights.money,
        business: businessScore * weights.business,
        livability: livabilityScore * weights.livability,
      };
      const strongestFactor = Object.entries(factors).sort(([, left], [, right]) => right - left)[0][0] as keyof typeof factors;
      return { ...candidate, strongestFactor, fitScore: Math.round(factors.money + factors.business + factors.livability) };
    }).sort((left, right) => right.fitScore - left.fitScore || right.profile.score - left.profile.score).slice(0, 3);
  }, [ageBand, fxToJpy, grossOrigin, household, housing, lifestyle, origin.fxToJpy, recommendationPriority]);

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
    const input: SavedComparisonInput = { originId, destinationId, salary, salaryCurrency, household, housing, lifestyle, ageBand };
    const result = {
      originMonthlyRemaining: results.origin.monthlyRemaining,
      destinationMonthlyRemaining: results.destination.monthlyRemaining,
      originMonthlyRemainingYen: results.origin.monthlyRemaining * origin.fxToJpy,
      destinationMonthlyRemainingYen: results.destination.monthlyRemaining * destination.fxToJpy,
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
    const input = record.input as Partial<SavedComparisonInput>;
    if (typeof input.originId !== "string" || !(input.originId in cities) || typeof input.destinationId !== "string" || !(input.destinationId in cities)) {
      setAuthMessage(language === "ja" ? "この履歴は現在の都市データと合わないため呼び出せません。" : "This history entry no longer matches the current city data.");
      return;
    }
    setOriginId(input.originId as CityId);
    setDestinationId(input.destinationId as CityId);
    if (typeof input.salary === "string") setSalary(input.salary);
    if (input.salaryCurrency === "origin" || input.salaryCurrency === "JPY") setSalaryCurrency(input.salaryCurrency);
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
            <a className="hero-cta" href="#compare">{language === "ja" ? "都市を比較する" : "Compare cities"}<span>↘</span></a>
          </div>
          <div className="hero-visual" aria-label={language === "ja" ? "海と海外の街並み" : "Coastal international city"}>
            <div className="hero-visual-caption"><span>48°51′N · COASTAL EDITION</span><strong>{language === "ja" ? "暮らす場所を、意思で選ぶ。" : "Choose where life can expand."}</strong></div>
            <div className="hero-visual-score"><small>{language === "ja" ? "注目都市" : "Spotlight"}</small><strong>10</strong><span>{language === "ja" ? "公式情報源で比較" : "official-source profiles"}</span></div>
          </div>
        </section>

        <section className="account-card" aria-labelledby="account-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Life Atlas</p>
              <h2 id="account-title">{t.accountTitle}</h2>
            </div>
            <p className="section-note">{t.accountDescription}</p>
          </div>

          {!authUser ? (
            <form className="account-grid" onSubmit={authSubmit}>
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
              <span className={`data-status ${dataLoading ? "is-loading" : officialData?.sourceStatus === "live" ? "is-live" : "is-partial"}`}>
                <span className="data-status-dot" />
                {dataLoading ? t.dataLoading : officialData?.sourceStatus === "live" ? t.dataLive : t.dataPartial}
              </span>
              <button className="data-refresh-button" type="button" onClick={() => void refreshOfficialData()} disabled={dataLoading}>
                {dataLoading ? t.updating : t.update}
              </button>
            </div>
            {dataError && <span className="data-error">{dataError} {t.fallback}</span>}
          </div>
          <div className="result-grid">
            {[results.origin, results.destination].map((result, index) => (
              <article className={`city-result-card ${index === 1 ? "featured-result" : ""}`} key={result.city.id}>
                <div className="city-card-top"><div><span className="city-region">{displayCityRegion(result.city)} / {displayCityCountry(result.city)}</span><h3>{displayCityName(result.city)}</h3></div><span className="city-initial">{displayCityName(result.city).slice(0, 1)}</span></div>
                <div className="big-number">{money(result.monthlyRemaining, result.city.currency)}<small>{t.monthly}</small></div>
                <div className="yen-caption">{t.yenValue} {yen(result.monthlyRemaining * result.city.fxToJpy)}</div>
                <div className="metric-list">
                  <div><span>{t.takeHome}</span><strong>{dualMoney(result.netMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.taxesInsurance}</span><strong>{dualMoney(result.taxBreakdown.totalDeductionsMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.monthlySpend}</span><strong>{dualMoney(result.totalMonthlyCosts, result.city.currency, result.city.fxToJpy)}</strong></div>
                  <div><span>{t.rentBurden}</span><strong>{result.rentBurden.toFixed(1)}%</strong></div>
                </div>
                <div className="deduction-list">
                  <div className="deduction-heading">{t.deductionHeading}</div>
                  <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.federalProvincialTax : result.city.taxSystem === "us" ? t.federalStateCityTax : t.incomeTax}</span><strong>{dualMoney(result.taxBreakdown.incomeTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  {result.city.taxSystem === "japan" ? <>
                    <div className="deduction-row"><span>{t.reconstructionTax}</span><strong>{dualMoney(result.taxBreakdown.reconstructionSurtaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.residentTax}</span><strong>{dualMoney(result.taxBreakdown.residentTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.healthInsurance}</span><strong>{dualMoney(result.taxBreakdown.healthInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.pension}</span><strong>{dualMoney(result.taxBreakdown.pensionMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    <div className="deduction-row"><span>{t.employmentInsurance}</span><strong>{dualMoney(result.taxBreakdown.employmentInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                    {ageBand === "40to64" && <div className="deduction-row"><span>{t.careInsurance}</span><strong>{dualMoney(result.taxBreakdown.careInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    <div className="deduction-row"><span>{t.childSupport}</span><strong>{dualMoney(result.taxBreakdown.childSupportMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                  </> : <>
                    {result.taxBreakdown.residentTaxMonthly > 0 && <div className="deduction-row"><span>{t.localTax}</span><strong>{dualMoney(result.taxBreakdown.residentTaxMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {result.taxBreakdown.healthInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "us" ? t.employerHealth : result.city.taxSystem === "france" ? t.medicalSocial : result.city.taxSystem === "mexico" ? t.imssHealth : t.healthInsurance}</span><strong>{dualMoney(result.taxBreakdown.healthInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {result.taxBreakdown.pensionMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.cppPension : result.city.taxSystem === "us" ? t.socialSecurity : result.city.taxSystem === "italy" ? t.inpsPension : result.city.taxSystem === "mexico" ? t.retirementFund : result.city.taxSystem === "france" ? t.pensionInsurance : t.retirement}</span><strong>{dualMoney(result.taxBreakdown.pensionMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {result.taxBreakdown.employmentInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? "EI employment insurance" : result.city.taxSystem === "uk" ? "National Insurance" : result.city.taxSystem === "france" ? t.unemployment : t.employmentInsurance}</span><strong>{dualMoney(result.taxBreakdown.employmentInsuranceMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {result.taxBreakdown.medicareLevyMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "australia" ? "Medicare levy" : t.medicare}</span><strong>{dualMoney(result.taxBreakdown.medicareLevyMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                    {result.taxBreakdown.employerSuperMonthly > 0 && <div className="deduction-row is-employer"><span>{t.employerSuper}</span><strong>{dualMoney(result.taxBreakdown.employerSuperMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>}
                  </>}
                  <div className="deduction-total"><span>{t.deductionTotal}</span><strong>{dualMoney(result.taxBreakdown.totalDeductionsMonthly, result.city.currency, result.city.fxToJpy)}</strong></div>
                </div>
                <div className="card-footer"><span className="status-dot" /> {index === 0 ? t.currentScenario : t.sameYenScenario}</div>
              </article>
            ))}
          </div>
          <div className="headline-callout"><span className="callout-icon">↗</span><div><strong>{results.destination.monthlyRemaining > results.origin.monthlyRemaining ? (language === "ja" ? `${displayCityName(destination)}の方が、月間の余裕が大きい試算です。` : `${displayCityName(destination)} has more monthly room in this estimate.`) : (language === "ja" ? `${displayCityName(origin)}の方が、月間の余裕が大きい試算です。` : `${displayCityName(origin)} has more monthly room in this estimate.`)}</strong><p>{t.calloutNote}</p></div></div>
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
            <div className="asset-compare"><div><span>{displayCityName(origin)}</span><strong>{dualMoney(results.origin.annualSavings, origin.currency, origin.fxToJpy)}</strong><small>{t.annualSavings}</small></div><div className="asset-divider">vs</div><div><span>{displayCityName(destination)}</span><strong>{dualMoney(results.destination.annualSavings, destination.currency, destination.fxToJpy)}</strong><small>{t.annualSavings}</small></div></div>
            <div className="index-grid"><div><span>{t.costIndex}</span><strong>{results.origin.costIndex}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.origin.purchasingPower}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.costIndex}</span><strong>{results.destination.costIndex}</strong><small>{displayCityName(destination)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.destination.purchasingPower}</strong><small>{displayCityName(destination)}</small></div></div>
            <div className="fire-note"><span>{t.fireNote}</span><strong>{t.fireTitle}</strong><small>{t.fireDescription}</small></div>
          </div>
        </section>

        <section id="profile" className="profile-section section-anchor">
          <div className="section-heading"><div><p className="eyebrow">{t.profileEyebrow}</p><h2>{t.profileTitle}</h2></div><p className="section-note">{t.profileNote}</p></div>
          <div className="profile-grid">
            {[origin, destination].map((city) => {
              const cityPopulation = officialData?.cityFacts?.[city.id]?.population;
              return <article className="profile-card" key={city.id}><div className="profile-header"><div><span className="city-region">{displayCityRegion(city)} / {displayCityCountry(city)}</span><h3>{displayCityName(city)}</h3></div><span className="currency-chip">{city.currency}</span></div><div className="profile-facts"><div><span>{t.population}</span><strong>{cityPopulation ? formatPopulation(cityPopulation.value, cityPopulation.period, language === "ja" ? displayCityName(city) : englishCityLabel(city).name, language) : language === "ja" ? city.population : cityPopulationEnglish[city.id] ?? city.population}</strong></div><div><span>{t.timezone}</span><strong>{language === "ja" ? city.timezone : cityTimezoneEnglish[city.id] ?? city.timezone}</strong></div><div><span>{t.climate}</span><strong>{displayCityClimate(city)}</strong></div><div><span>{t.officialLanguage}</span><strong>{displayCityLanguage(city)}</strong></div></div><div className="profile-tags"><span>{t.japaneseFood} {city.scores.japaneseFood}/100</span><span>{t.englishLiving} {city.scores.english}/100</span><span>{t.internetScore} {city.scores.internet}/100</span><span>{t.transitScore} {city.scores.transit}/100</span></div><p className="source-quality">{t.dataCoverage}{language === "ja" ? city.sourceLabel : "Population and price data use public sources; salary and rent are regional reference estimates."}</p></article>;
            })}
          </div>
        </section>

        <section className="score-section">
          <div className="section-heading"><div><p className="eyebrow">{t.scoreEyebrow}</p><h2>{t.scoreTitle}</h2></div><span className="score-note">{t.scoreNote}</span></div>
          <div className="score-board"><div className="score-city-labels"><span /><strong>{displayCityName(origin)}</strong><strong>{displayCityName(destination)}</strong></div>{scoreRows.map(([labelJa, labelEn, key]) => <div className="score-row" key={key}><span className="score-name">{language === "ja" ? labelJa : labelEn}</span><div className="score-value"><div className="score-track"><span className="score-fill origin-fill" style={{ width: `${results.origin.scores[key]}%` }} /></div><strong>{results.origin.scores[key]}</strong></div><div className="score-value"><div className="score-track"><span className="score-fill destination-fill" style={{ width: `${results.destination.scores[key]}%` }} /></div><strong>{results.destination.scores[key]}</strong></div></div>)}</div>
          <p className="panel-footnote">{t.scoreFootnote}</p>
        </section>

        <section id="recommendations" className="recommendation-section section-anchor">
          <div className="recommendation-heading">
            <div><p className="eyebrow">07 / YOUR CITY MATCHES</p><h2>{language === "ja" ? "今の条件から、次に見るべき3都市。" : "Three cities worth exploring next."}</h2></div>
            <p>{language === "ja" ? "入力済みの給与・世帯・住居条件に、ビジネス環境と暮らしやすさを重ねて候補を更新します。" : "Your salary, household and housing inputs are combined with business conditions and livability to refresh these matches."}</p>
          </div>
          <div className="recommendation-priority" role="group" aria-label={language === "ja" ? "候補都市の優先軸" : "City match priority"}>
            {(["balance", "money", "business"] as RecommendationPriority[]).map((priority) => <button key={priority} type="button" className={recommendationPriority === priority ? "is-active" : ""} aria-pressed={recommendationPriority === priority} onClick={() => setRecommendationPriority(priority)}>{priority === "balance" ? (language === "ja" ? "バランス重視" : "Balanced") : priority === "money" ? (language === "ja" ? "手元資金重視" : "Money left") : (language === "ja" ? "ビジネス重視" : "Business first")}</button>)}
          </div>
          <div className="recommendation-grid">
            {recommendations.map((recommendation, index) => {
              const reason = recommendation.strongestFactor === "money" ? (language === "ja" ? "現在の条件で手元資金を残しやすい" : "Stronger money-left outlook for your inputs") : recommendation.strongestFactor === "business" ? (language === "ja" ? "事業環境の総合力が高い" : "Strong overall business conditions") : (language === "ja" ? "暮らしやすさとのバランスが良い" : "Good balance with livability");
              return <article className="recommendation-card" key={recommendation.profile.cityId}>
                <div className="recommendation-rank"><span>0{index + 1}</span><small>{language === "ja" ? "候補" : "MATCH"}</small></div>
                <div className="recommendation-city"><span>{recommendation.profile.country[language]}</span><h3>{recommendation.profile.city[language]}</h3><p>{reason}</p></div>
                <div className="recommendation-fit"><strong>{recommendation.fitScore}</strong><small>/ 100 {language === "ja" ? "適合度" : "fit"}</small></div>
                <div className="recommendation-metrics"><div><span>{language === "ja" ? "月に残る試算" : "Money left / month"}</span><strong>{yen(recommendation.remainingJpy)}</strong></div><div><span>{language === "ja" ? "ビジネス" : "Business"}</span><strong>{recommendation.profile.score}</strong></div><div><span>{language === "ja" ? "暮らしやすさ" : "Livability"}</span><strong>{recommendation.result.scores.livability}</strong></div></div>
                <p className="recommendation-fit-copy"><span>{language === "ja" ? "向いている事業" : "Strong fit"}</span>{recommendation.profile.fit[language]}</p>
                <button className="business-compare-button" type="button" onClick={() => compareBusinessCity(recommendation.profile.cityId)} aria-label={language === "ja" ? `${recommendation.profile.city.ja}を目的地に設定して詳しく比較する` : `Compare ${recommendation.profile.city.en} in detail`}><span>{language === "ja" ? "この都市を詳しく比較する" : "Compare this city in detail"}</span><strong>→</strong></button>
              </article>;
            })}
          </div>
          <div className="recommendation-method"><span>{language === "ja" ? "現在の配点" : "Current weighting"}</span><strong>{recommendationPriority === "balance" ? (language === "ja" ? "手元資金40%・ビジネス35%・暮らし25%" : "Money 40% · Business 35% · Livability 25%") : recommendationPriority === "money" ? (language === "ja" ? "手元資金60%・ビジネス20%・暮らし20%" : "Money 60% · Business 20% · Livability 20%") : (language === "ja" ? "手元資金20%・ビジネス60%・暮らし20%" : "Money 20% · Business 60% · Livability 20%")}</strong><p>{language === "ja" ? "注目10都市内での比較用試算です。移住・投資・税務判断を代替するものではありません。" : "This is a comparison estimate across the ten featured cities and does not replace relocation, investment or tax advice."}</p></div>
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
          <div className="mini-panel"><span className="mini-icon">⌁</span><div><h3>{t.transparencyTitle}</h3><p>{t.transparencyText}</p><button className="inline-link" onClick={openMethodDetails}>{t.sourcesNotes} <span>→</span></button></div></div>
        </section>

        {detailsOpen && <section id="method" className="method-panel section-anchor"><div className="section-heading"><div><p className="eyebrow">{t.methodEyebrow}</p><h2>{t.methodTitle}</h2></div><button className="close-button" onClick={() => setDetailsOpen(false)}>{t.close}</button></div><div className="method-grid"><div><span>{t.dataStatus}</span><strong>{dataLoading ? t.dataLoading : officialData?.sourceStatus === "live" ? t.dataLiveMethod : t.dataFallbackMethod}</strong><p>{language === "ja" ? "人口は国・都市の公的統計、為替はECBから自動取得します。" : "Population uses public country or city statistics, while FX is retrieved automatically from the ECB."}{t.retrievedAt}{officialData ? new Date(officialData.retrievedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US") : language === "ja" ? "未取得" : "Not available"}</p></div><div><span>{t.cityCosts}</span><strong>{t.cityCostsStrong}</strong><p>{t.cityCostsText}</p></div><div><span>{t.taxes}</span><strong>{t.taxesStrong}</strong><p>{t.taxesText}</p></div><div><span>{t.formula}</span><strong>{t.formulaStrong}</strong><p>{t.formulaText}</p></div></div>{officialData && <div className="source-list"><span>{t.autoSources}</span>{officialData.sources.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noreferrer">{source.name} <small>（{sourceScope(source.scope, language)}）</small> ↗</a>)}</div>}<div className="source-list"><span>{t.citySources}</span>{citySourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source} <small>（{sourceItem(source.item, language)} / {sourceLevel(source.level, language)} / {source.period}）</small> ↗</a>)}</div></section>}

        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">✦</span><strong>Life Atlas</strong><p>{t.footerText}</p></div><div className="footer-meta"><span>{t.footerCities}</span><span>{t.footerDeductions}</span><span>© 2026 Life Atlas</span></div></footer>
      </div>
    </main>
  );
}
