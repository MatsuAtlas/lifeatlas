"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CityId = "tokyo" | "osaka" | "vancouver" | "toronto" | "losAngeles" | "newYork" | "london" | "paris" | "rome" | "queretaro" | "puebla" | "merida" | "mexicoCity" | "melbourne";
type CurrencyCode = "JPY" | "CAD" | "USD" | "GBP" | "EUR" | "MXN" | "AUD";
type AgeBand = "under40" | "40to64" | "65plus";
type Language = "ja" | "en";

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
  taxSystem: "japan" | "canada" | "us" | "uk" | "france" | "italy" | "mexico" | "australia";
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

const cities: Record<CityId, City> = {
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

const cityOrder: CityId[] = ["tokyo", "osaka", "vancouver", "toronto", "losAngeles", "newYork", "london", "paris", "rome", "queretaro", "puebla", "merida", "mexicoCity", "melbourne"];
const householdMultipliers = {
  single: 1,
  couple: 1.55,
  singleParent: 1.42,
  coupleOneChild: 1.8,
  family: 2.05,
  familyThreeChildren: 2.45,
} as const;
const housingMultipliers = { shared: 0.58, onebed: 1, twobed: 1.55 };
const lifestyleMultipliers = { lean: 0.8, balanced: 1, comfortable: 1.25 };

const cityEnglishLabels: Record<CityId, { name: string; country: string; region: string; climate: string; language: string }> = {
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
const cityPopulationEnglish: Record<CityId, string> = {
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
const cityTimezoneEnglish: Record<CityId, string> = {
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
    heroEyebrow: "収入と都市の比較ノート",
    heroTitleBefore: "あなたの収入は、",
    heroTitleEmphasis: "どの都市",
    heroTitleAfter: "でより強くなるか。",
    heroText: "給与だけでは見えない、税金・家賃・生活費・購買力をひとつの地図に。今の条件で、毎月いくら残るかを比べます。",
    pillCities: "14都市対応",
    pillCurrencies: "現地通貨 + 日本円",
    pillDeductions: "税金・保険料込み",
    compareEyebrow: "01 / 条件をセット",
    compareTitle: "あなたの比較シナリオ",
    salaryNotSaved: "入力した給与は保存されません",
    origin: "出発地",
    destination: "目的地",
    swapAria: "出発地と目的地を入れ替える",
    salary: "年間総支給給与",
    salaryHint: "出発地の現地通貨で入力",
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
    localCurrency: "現地通貨",
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
    footerCities: "14都市対応",
    footerDeductions: "税金・保険料込み",
    householdSingle: "単身成人",
    householdCouple: "大人2人",
    householdSingleParent: "ひとり親 + 子ども1人",
    householdOneChild: "大人2人 + 子ども1人",
    householdTwoChildren: "大人2人 + 子ども2人",
    householdThreeChildren: "大人2人 + 子ども3人",
    housingShared: "シェア・個室",
    housingOnebed: "1ベッドルーム",
    housingTwobed: "2ベッドルーム",
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
    heroEyebrow: "An income and city comparison note",
    heroTitleBefore: "Where does your income",
    heroTitleEmphasis: "go further",
    heroTitleAfter: "?",
    heroText: "Put taxes, rent, living costs and purchasing power on one map. Compare how much money remains each month under your conditions.",
    pillCities: "14 cities",
    pillCurrencies: "Local currency + JPY",
    pillDeductions: "Taxes and insurance included",
    compareEyebrow: "01 / SET YOUR CONDITIONS",
    compareTitle: "Your comparison scenario",
    salaryNotSaved: "Your salary input is not saved",
    origin: "Origin",
    destination: "Destination",
    swapAria: "Swap origin and destination",
    salary: "Annual gross salary",
    salaryHint: "Enter it in the origin city's currency",
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
    localCurrency: "Local currency",
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
    footerCities: "14 cities",
    footerDeductions: "Taxes and insurance included",
    householdSingle: "Single adult",
    householdCouple: "Two adults",
    householdSingleParent: "Single parent + 1 child",
    householdOneChild: "Two adults + 1 child",
    householdTwoChildren: "Two adults + 2 children",
    householdThreeChildren: "Two adults + 3 children",
    housingShared: "Shared / private room",
    housingOnebed: "1-bedroom",
    housingTwobed: "2-bedroom",
    lifestyleLean: "Lean",
    lifestyleBalanced: "Balanced",
    lifestyleComfortable: "Comfortable",
    ageUnder40: "Under 40",
    age40to64: "40–64",
    age65plus: "65+",
  },
} as const;

const cityName = (city: City, language: Language) => language === "ja" ? city.name : cityEnglishLabels[city.id].name;
const cityCountry = (city: City, language: Language) => language === "ja" ? city.country : cityEnglishLabels[city.id].country;
const cityRegion = (city: City, language: Language) => language === "ja" ? city.region : cityEnglishLabels[city.id].region;
const cityClimate = (city: City, language: Language) => language === "ja" ? city.climate : cityEnglishLabels[city.id].climate;
const cityLanguage = (city: City, language: Language) => language === "ja" ? city.language : cityEnglishLabels[city.id].language;
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

export default function Home() {
  const [language, setLanguage] = useState<Language>("ja");
  const [originId, setOriginId] = useState<CityId>("tokyo");
  const [destinationId, setDestinationId] = useState<CityId>("melbourne");
  const [salary, setSalary] = useState("8500000");
  const [household, setHousehold] = useState<keyof typeof householdMultipliers>("single");
  const [housing, setHousing] = useState<keyof typeof housingMultipliers>("onebed");
  const [lifestyle, setLifestyle] = useState<keyof typeof lifestyleMultipliers>("balanced");
  const [ageBand, setAgeBand] = useState<AgeBand>("under40");
  const [darkMode, setDarkMode] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [officialData, setOfficialData] = useState<OfficialData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const t = translations[language];
  const displayCityName = (city: City) => cityName(city, language);
  const displayCityCountry = (city: City) => cityCountry(city, language);
  const displayCityRegion = (city: City) => cityRegion(city, language);
  const displayCityClimate = (city: City) => cityClimate(city, language);
  const displayCityLanguage = (city: City) => cityLanguage(city, language);
  const money = (value: number, currency: CurrencyCode) => formatMoney(value, currency, language);
  const yen = (value: number) => formatYen(value, language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const refreshOfficialData = async () => {
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
  };

  useEffect(() => {
    void refreshOfficialData();
  }, []);

  const fallbackFxToJpy: Record<CurrencyCode, number> = { JPY: 1, CAD: 108, USD: 145, GBP: 190, EUR: 170, MXN: 8.5, AUD: 98 };
  const originBase = cities[originId];
  const destinationBase = cities[destinationId];
  const fxToJpy = (currency: CurrencyCode) => currency === "JPY" ? 1 : (officialData?.exchangeRates[currency] ?? fallbackFxToJpy[currency]);
  const origin = useMemo(() => ({ ...originBase, fxToJpy: fxToJpy(originBase.currency) }), [originBase, officialData]);
  const destination = useMemo(() => ({ ...destinationBase, fxToJpy: fxToJpy(destinationBase.currency) }), [destinationBase, officialData]);
  const grossOrigin = Number(salary) || 0;
  const destinationGross = origin.fxToJpy === destination.fxToJpy ? grossOrigin : (grossOrigin * origin.fxToJpy) / destination.fxToJpy;

  const results = useMemo(() => ({
    origin: calculateCity(origin, grossOrigin, household, housing, lifestyle, ageBand),
    destination: calculateCity(destination, destinationGross, household, housing, lifestyle, ageBand),
  }), [origin, destination, grossOrigin, destinationGross, household, housing, lifestyle, ageBand]);

  const handleCalculate = () => {
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const swapCities = () => {
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  const resetForm = () => {
    setOriginId("tokyo");
    setDestinationId("melbourne");
    setSalary("8500000");
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
          <a href="#profile">{t.navProfile}</a>
          <a href="#method">{t.navMethod}</a>
        </nav>
        <div className="header-actions">
          <button className="language-button" onClick={() => setLanguage((value) => value === "ja" ? "en" : "ja")} aria-label={t.languageAria}>{t.languageSwitch}</button>
          <button className="theme-button" onClick={() => setDarkMode((value) => !value)} aria-label={t.themeAria}>
            {darkMode ? t.themeToLight : t.themeToDark}
          </button>
        </div>
      </header>

      <div id="top" className="page-wrap">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.heroEyebrow}</p>
            <h1>{t.heroTitleBefore}<em>{t.heroTitleEmphasis}</em>{t.heroTitleAfter}</h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-pills">
              <span>{t.pillCities}</span><span>{t.pillCurrencies}</span><span>{t.pillDeductions}</span>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-core"><strong>¥</strong><small>income<br />atlas</small></div>
            <span className="orbit-label orbit-label-one">{displayCityName(cities.tokyo)}</span>
            <span className="orbit-label orbit-label-two">{displayCityName(cities.newYork)}</span>
            <span className="orbit-label orbit-label-three">{displayCityName(cities.melbourne)}</span>
          </div>
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
              <div className="input-with-unit"><input inputMode="numeric" value={salary} onChange={(event) => setSalary(event.target.value.replace(/[^0-9]/g, ""))} aria-label={t.salary} /><span>{origin.currency}</span></div>
              <small>{t.salaryHint}</small>
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
                <option value="shared">{t.housingShared}</option><option value="onebed">{t.housingOnebed}</option><option value="twobed">{t.housingTwobed}</option>
              </select>
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
                  <div><span>{t.takeHome}</span><strong>{money(result.netMonthly, result.city.currency)}</strong></div>
                  <div><span>{t.taxesInsurance}</span><strong>{money(result.taxBreakdown.totalDeductionsMonthly, result.city.currency)}</strong></div>
                  <div><span>{t.monthlySpend}</span><strong>{money(result.totalMonthlyCosts, result.city.currency)}</strong></div>
                  <div><span>{t.rentBurden}</span><strong>{result.rentBurden.toFixed(1)}%</strong></div>
                </div>
                <div className="deduction-list">
                  <div className="deduction-heading">{t.deductionHeading}</div>
                  <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.federalProvincialTax : result.city.taxSystem === "us" ? t.federalStateCityTax : t.incomeTax}</span><strong>{money(result.taxBreakdown.incomeTaxMonthly, result.city.currency)}</strong></div>
                  {result.city.taxSystem === "japan" ? <>
                    <div className="deduction-row"><span>{t.reconstructionTax}</span><strong>{money(result.taxBreakdown.reconstructionSurtaxMonthly, result.city.currency)}</strong></div>
                    <div className="deduction-row"><span>{t.residentTax}</span><strong>{money(result.taxBreakdown.residentTaxMonthly, result.city.currency)}</strong></div>
                    <div className="deduction-row"><span>{t.healthInsurance}</span><strong>{money(result.taxBreakdown.healthInsuranceMonthly, result.city.currency)}</strong></div>
                    <div className="deduction-row"><span>{t.pension}</span><strong>{money(result.taxBreakdown.pensionMonthly, result.city.currency)}</strong></div>
                    <div className="deduction-row"><span>{t.employmentInsurance}</span><strong>{money(result.taxBreakdown.employmentInsuranceMonthly, result.city.currency)}</strong></div>
                    {ageBand === "40to64" && <div className="deduction-row"><span>{t.careInsurance}</span><strong>{money(result.taxBreakdown.careInsuranceMonthly, result.city.currency)}</strong></div>}
                    <div className="deduction-row"><span>{t.childSupport}</span><strong>{money(result.taxBreakdown.childSupportMonthly, result.city.currency)}</strong></div>
                  </> : <>
                    {result.taxBreakdown.residentTaxMonthly > 0 && <div className="deduction-row"><span>{t.localTax}</span><strong>{money(result.taxBreakdown.residentTaxMonthly, result.city.currency)}</strong></div>}
                    {result.taxBreakdown.healthInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "us" ? t.employerHealth : result.city.taxSystem === "france" ? t.medicalSocial : result.city.taxSystem === "mexico" ? t.imssHealth : t.healthInsurance}</span><strong>{money(result.taxBreakdown.healthInsuranceMonthly, result.city.currency)}</strong></div>}
                    {result.taxBreakdown.pensionMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? t.cppPension : result.city.taxSystem === "us" ? t.socialSecurity : result.city.taxSystem === "italy" ? t.inpsPension : result.city.taxSystem === "mexico" ? t.retirementFund : result.city.taxSystem === "france" ? t.pensionInsurance : t.retirement}</span><strong>{money(result.taxBreakdown.pensionMonthly, result.city.currency)}</strong></div>}
                    {result.taxBreakdown.employmentInsuranceMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "canada" ? "EI employment insurance" : result.city.taxSystem === "uk" ? "National Insurance" : result.city.taxSystem === "france" ? t.unemployment : t.employmentInsurance}</span><strong>{money(result.taxBreakdown.employmentInsuranceMonthly, result.city.currency)}</strong></div>}
                    {result.taxBreakdown.medicareLevyMonthly > 0 && <div className="deduction-row"><span>{result.city.taxSystem === "australia" ? "Medicare levy" : t.medicare}</span><strong>{money(result.taxBreakdown.medicareLevyMonthly, result.city.currency)}</strong></div>}
                    {result.taxBreakdown.employerSuperMonthly > 0 && <div className="deduction-row is-employer"><span>{t.employerSuper}</span><strong>{money(result.taxBreakdown.employerSuperMonthly, result.city.currency)}</strong></div>}
                  </>}
                  <div className="deduction-total"><span>{t.deductionTotal}</span><strong>{money(result.taxBreakdown.totalDeductionsMonthly, result.city.currency)}</strong></div>
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
                const max = Math.max(Number(originValue), Number(destinationValue));
                return <div className="cost-row" key={label as string}><div className="cost-label"><span>{label}</span><small>{money(Number(originValue), origin.currency)} / {money(Number(destinationValue), destination.currency)}</small></div><div className="bars"><span className="bar bar-origin" style={{ width: `${Math.max(8, (Number(originValue) / max) * 100)}%` }} /><span className="bar bar-destination" style={{ width: `${Math.max(8, (Number(destinationValue) / max) * 100)}%` }} /></div></div>;
              })}
            </div>
            <p className="panel-footnote">{t.yenFootnote}</p>
          </div>
          <div className="panel asset-panel">
            <div className="panel-heading"><div><p className="eyebrow">{t.assetEyebrow}</p><h2>{t.assetTitle}</h2></div><span className="sparkle">✦</span></div>
            <div className="asset-compare"><div><span>{displayCityName(origin)}</span><strong>{yen(results.origin.annualSavings * origin.fxToJpy)}</strong><small>{t.annualSavings}</small></div><div className="asset-divider">vs</div><div><span>{displayCityName(destination)}</span><strong>{yen(results.destination.annualSavings * destination.fxToJpy)}</strong><small>{t.annualSavings}</small></div></div>
            <div className="index-grid"><div><span>{t.costIndex}</span><strong>{results.origin.costIndex}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.origin.purchasingPower}</strong><small>{displayCityName(origin)}</small></div><div><span>{t.costIndex}</span><strong>{results.destination.costIndex}</strong><small>{displayCityName(destination)}</small></div><div><span>{t.purchasingPower}</span><strong>{results.destination.purchasingPower}</strong><small>{displayCityName(destination)}</small></div></div>
            <div className="fire-note"><span>{t.fireNote}</span><strong>{t.fireTitle}</strong><small>{t.fireDescription}</small></div>
          </div>
        </section>

        <section id="profile" className="profile-section section-anchor">
          <div className="section-heading"><div><p className="eyebrow">{t.profileEyebrow}</p><h2>{t.profileTitle}</h2></div><p className="section-note">{t.profileNote}</p></div>
          <div className="profile-grid">
            {[origin, destination].map((city) => {
              const cityPopulation = officialData?.cityFacts?.[city.id]?.population;
              return <article className="profile-card" key={city.id}><div className="profile-header"><div><span className="city-region">{displayCityRegion(city)} / {displayCityCountry(city)}</span><h3>{displayCityName(city)}</h3></div><span className="currency-chip">{city.currency}</span></div><div className="profile-facts"><div><span>{t.population}</span><strong>{cityPopulation ? formatPopulation(cityPopulation.value, cityPopulation.period, language === "ja" ? displayCityName(city) : cityEnglishLabels[city.id].name, language) : language === "ja" ? city.population : cityPopulationEnglish[city.id]}</strong></div><div><span>{t.timezone}</span><strong>{language === "ja" ? city.timezone : cityTimezoneEnglish[city.id]}</strong></div><div><span>{t.climate}</span><strong>{displayCityClimate(city)}</strong></div><div><span>{t.officialLanguage}</span><strong>{displayCityLanguage(city)}</strong></div></div><div className="profile-tags"><span>{t.japaneseFood} {city.scores.japaneseFood}/100</span><span>{t.englishLiving} {city.scores.english}/100</span><span>{t.internetScore} {city.scores.internet}/100</span><span>{t.transitScore} {city.scores.transit}/100</span></div><p className="source-quality">{t.dataCoverage}{language === "ja" ? city.sourceLabel : "Population and price data use public sources; salary and rent are regional reference estimates."}</p></article>;
            })}
          </div>
        </section>

        <section className="score-section">
          <div className="section-heading"><div><p className="eyebrow">{t.scoreEyebrow}</p><h2>{t.scoreTitle}</h2></div><span className="score-note">{t.scoreNote}</span></div>
          <div className="score-board"><div className="score-city-labels"><span /><strong>{displayCityName(origin)}</strong><strong>{displayCityName(destination)}</strong></div>{scoreRows.map(([labelJa, labelEn, key]) => <div className="score-row" key={key}><span className="score-name">{language === "ja" ? labelJa : labelEn}</span><div className="score-value"><div className="score-track"><span className="score-fill origin-fill" style={{ width: `${results.origin.scores[key]}%` }} /></div><strong>{results.origin.scores[key]}</strong></div><div className="score-value"><div className="score-track"><span className="score-fill destination-fill" style={{ width: `${results.destination.scores[key]}%` }} /></div><strong>{results.destination.scores[key]}</strong></div></div>)}</div>
          <p className="panel-footnote">{t.scoreFootnote}</p>
        </section>

        <section className="details-grid">
          <div className="mini-panel"><span className="mini-icon">◎</span><div><h3>{t.businessTitle}</h3><p>{t.businessText}</p><button className="inline-link" onClick={() => setDetailsOpen((value) => !value)}>{t.moreDetails} <span>→</span></button></div></div>
          <div className="mini-panel"><span className="mini-icon">⌁</span><div><h3>{t.transparencyTitle}</h3><p>{t.transparencyText}</p><button className="inline-link" onClick={() => setDetailsOpen((value) => !value)}>{t.sourcesNotes} <span>→</span></button></div></div>
        </section>

        {detailsOpen && <section id="method" className="method-panel section-anchor"><div className="section-heading"><div><p className="eyebrow">{t.methodEyebrow}</p><h2>{t.methodTitle}</h2></div><button className="close-button" onClick={() => setDetailsOpen(false)}>{t.close}</button></div><div className="method-grid"><div><span>{t.dataStatus}</span><strong>{dataLoading ? t.dataLoading : officialData?.sourceStatus === "live" ? t.dataLiveMethod : t.dataFallbackMethod}</strong><p>{language === "ja" ? "人口は国・都市の公的統計、為替はECBから自動取得します。" : "Population uses public country or city statistics, while FX is retrieved automatically from the ECB."}{t.retrievedAt}{officialData ? new Date(officialData.retrievedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US") : language === "ja" ? "未取得" : "Not available"}</p></div><div><span>{t.cityCosts}</span><strong>{t.cityCostsStrong}</strong><p>{t.cityCostsText}</p></div><div><span>{t.taxes}</span><strong>{t.taxesStrong}</strong><p>{t.taxesText}</p></div><div><span>{t.formula}</span><strong>{t.formulaStrong}</strong><p>{t.formulaText}</p></div></div>{officialData && <div className="source-list"><span>{t.autoSources}</span>{officialData.sources.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noreferrer">{source.name} <small>（{sourceScope(source.scope, language)}）</small> ↗</a>)}</div>}<div className="source-list"><span>{t.citySources}</span>{citySourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source} <small>（{sourceItem(source.item, language)} / {sourceLevel(source.level, language)} / {source.period}）</small> ↗</a>)}</div></section>}

        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark">✦</span><strong>Life Atlas</strong><p>{t.footerText}</p></div><div className="footer-meta"><span>{t.footerCities}</span><span>{t.footerDeductions}</span><span>© 2026 Life Atlas</span></div></footer>
      </div>
    </main>
  );
}
