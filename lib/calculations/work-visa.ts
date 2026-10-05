import type { CurrencyCode } from "../../types/city";
import type { WorkVisaSalaryCheck } from "../../types/scenario";

// 主な就労ビザの給与基準（2026年、各国政府の公式ページで確認した値）。給与だけで判定できる部分に限り、
// 雇用主のスポンサー登録・職種・学歴・語学・ポイント審査などの他の条件は判定しません。
// 比較には賞与を除いた年間の基本給を使います（英国・アイルランド・豪州・シンガポールは基本給・保証給与で判定し、
// 賞与を含めると基準を満たす場合は「確認が必要」とします）。
type Threshold = {
  route: { ja: string; en: string };
  currency: CurrencyCode;
  // 年額の基準。年齢で変わる国は関数で返します。
  annual: (age: number) => number;
  reduced?: { annual: number; condition: { ja: string; en: string } };
  // オランダは月額基準が8%の休暇手当を含むかを公式ページで確認できないため、その幅を「確認が必要」とします。
  holidayAllowanceUnclear?: boolean;
  source: { name: string; url: string; period: string };
};

// シンガポールEP（金融以外の業種）：2027年1月1日より前の新規申請の月額基準。23歳以下S$5,600〜45歳以上S$10,700。
const singaporeEpMonthly: Record<number, number> = {
  23: 5_600, 24: 5_832, 25: 6_064, 26: 6_295, 27: 6_527, 28: 6_759, 29: 6_991, 30: 7_223, 31: 7_455, 32: 7_686, 33: 7_918,
  34: 8_150, 35: 8_382, 36: 8_614, 37: 8_845, 38: 9_077, 39: 9_309, 40: 9_541, 41: 9_773, 42: 10_005, 43: 10_236, 44: 10_468, 45: 10_700,
};

export const WORK_VISA_THRESHOLDS: Partial<Record<string, Threshold>> = {
  GBR: {
    route: { ja: "英国 Skilled Worker", en: "UK Skilled Worker" },
    currency: "GBP",
    annual: () => 41_700,
    reduced: { annual: 33_400, condition: { ja: "新卒・博士・不足職種など一部の条件で£33,400まで下がる場合があります", en: "Can fall to £33,400 for new entrants, PhDs, shortage roles and some other cases" } },
    source: { name: "GOV.UK・Skilled Worker visa: Your job", url: "https://www.gov.uk/skilled-worker-visa/your-job", period: "2025年7月22日以降の新規" },
  },
  DEU: {
    route: { ja: "ドイツ EUブルーカード", en: "Germany EU Blue Card" },
    currency: "EUR",
    annual: () => 50_700,
    reduced: { annual: 45_934.2, condition: { ja: "不足職種と卒業3年以内の人は€45,934.20（連邦雇用庁の同意が必要）", en: "€45,934.20 for shortage occupations and recent graduates (Federal Employment Agency approval required)" } },
    source: { name: "Bundesanzeiger・Bekanntmachung zu § 18g AufenthG (BAnz AT 18.12.2025 B3)", url: "https://www.bundesanzeiger.de/pub/publication/REViP4bN6jVdpGxPaiQ/content/REViP4bN6jVdpGxPaiQ/BAnz%20AT%2018.12.2025%20B3.pdf?inline=", period: "2026年" },
  },
  NLD: {
    route: { ja: "オランダ 高度技能移民（kennismigrant）", en: "Netherlands highly skilled migrant" },
    currency: "EUR",
    annual: (age) => (age < 30 ? 4_357 : 5_942) * 12,
    holidayAllowanceUnclear: true,
    source: { name: "IND・Required amounts income requirements", url: "https://ind.nl/en/required-amounts-income-requirements", period: "2026年" },
  },
  IRL: {
    route: { ja: "アイルランド Critical Skills Employment Permit", en: "Ireland Critical Skills Employment Permit" },
    currency: "EUR",
    annual: () => 68_911,
    reduced: { annual: 40_904, condition: { ja: "重要技能職業リストの職種で学位がある場合は€40,904（卒業1年以内は€36,848）", en: "€40,904 for Critical Skills Occupations List roles with a degree (€36,848 within 12 months of graduating)" } },
    source: { name: "Department of Enterprise・Critical Skills Employment Permit", url: "https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/permit-types/critical-skills-employment-permit/", period: "2026年確認" },
  },
  AUS: {
    route: { ja: "オーストラリア Skills in Demand（Core Skills）", en: "Australia Skills in Demand (Core Skills)" },
    currency: "AUD",
    annual: () => 79_423,
    source: { name: "Department of Home Affairs・Salary requirements", url: "https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/sponsoring-workers/nominating-a-position/salary-requirements", period: "2026年7月1日〜2027年6月30日の申請" },
  },
  SGP: {
    route: { ja: "シンガポール Employment Pass", en: "Singapore Employment Pass" },
    currency: "SGD",
    annual: (age) => singaporeEpMonthly[Math.min(45, Math.max(23, Math.floor(age)))] * 12,
    source: { name: "Ministry of Manpower・Employment Pass eligibility", url: "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility", period: "2027年1月1日より前の新規申請（金融以外の業種）" },
  },
};

const HOLIDAY_ALLOWANCE = 0.08;

// baseSalaryLocal・bonusLocalは都市の通貨に換算済みの年額。基準の通貨と都市の通貨が違う場合は判定しません。
export function checkWorkVisaSalary(countryCode: string, currency: CurrencyCode, baseSalaryLocal: number, bonusLocal: number, age: number): WorkVisaSalaryCheck | null {
  const threshold = WORK_VISA_THRESHOLDS[countryCode];
  if (!threshold || threshold.currency !== currency) return null;
  const annualThreshold = threshold.annual(age);
  const meetsAt = (amount: number) => threshold.holidayAllowanceUnclear
    ? amount / (1 + HOLIDAY_ALLOWANCE) >= annualThreshold ? "meets" : amount >= annualThreshold ? "check" : "below"
    : amount >= annualThreshold ? "meets" : "below";
  const base = meetsAt(baseSalaryLocal);
  const status = base === "below" && bonusLocal > 0 && meetsAt(baseSalaryLocal + bonusLocal) !== "below" ? "check" : base;
  return {
    countryCode,
    route: threshold.route,
    currency,
    annualThreshold,
    status,
    reason: status !== "check" ? null : base === "check" ? "holidayAllowance" : "bonus",
    meetsReducedThreshold: status === "below" && threshold.reduced ? baseSalaryLocal >= threshold.reduced.annual : null,
    reduced: threshold.reduced ?? null,
    source: threshold.source,
  };
}
