import type { InsuranceConfig } from "./finance";

export type CityId = "tokyo" | "osaka" | "vancouver" | "toronto" | "losAngeles" | "newYork" | "london" | "paris" | "rome" | "queretaro" | "puebla" | "merida" | "mexicoCity" | "melbourne" | "sapporo" | "fukuoka" | "seoul" | "taipei" | "singapore" | "hongKong" | "bangkok" | "kualaLumpur" | "jakarta" | "manila" | "hoChiMinh" | "beijing" | "shanghai" | "sydney" | "brisbane" | "perth" | "montreal" | "calgary" | "chicago" | "dallas" | "sanFrancisco" | "miami" | "boston" | "seattle" | "washingtonDc" | "madrid" | "berlin" | "amsterdam" | "lisbon" | "dubai" | "zurich" | "dublin" | "saoPaulo" | "buenosAires" | "santiago" | "bogota";

export type CurrencyCode = "JPY" | "CAD" | "USD" | "GBP" | "EUR" | "MXN" | "AUD" | "KRW" | "TWD" | "SGD" | "HKD" | "THB" | "MYR" | "IDR" | "PHP" | "VND" | "CNY" | "AED" | "CHF" | "BRL" | "ARS" | "CLP" | "COP";

export type DataSource = {
  item: string;
  level: "都市" | "都道府県" | "州" | "国" | "国・州" | "州・市" | "都市圏" | "自治体";
  period: string;
  source: string;
  url: string;
};

export type City = {
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
  taxSystem: "japan" | "canada" | "us" | "uk" | "france" | "italy" | "mexico" | "australia" | "singapore" | "uae" | "estimate";
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
