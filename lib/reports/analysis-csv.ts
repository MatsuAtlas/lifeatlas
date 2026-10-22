import { cities } from "../../data/cities.ts";
import { localizedCity } from "../cities/localization.ts";
import type { SavedAnalyzerInput } from "../../types/comparison.ts";
import type { WhatIfSnapshot } from "../../types/what-if.ts";

type ReportLanguage = "ja" | "en";

const cashflowBasisLabels = {
  individual: { ja: "本人", en: "Individual" },
  household: { ja: "世帯（本人＋配偶者）", en: "Household (you and spouse)" },
} as const;

const utilitiesBasisLabels = {
  separate: { ja: "別に計上", en: "Counted separately" },
  includedInRent: { ja: "住居費に含む", en: "Included in housing" },
  customRentUnconfirmed: { ja: "未確認（別に計上）", en: "Not confirmed (counted separately)" },
  inCustomTotal: { ja: "生活費の総額に含む", en: "Within custom spending total" },
} as const;

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildAnalysisCsv(language: ReportLanguage, analysis: SavedAnalyzerInput, snapshot: WhatIfSnapshot) {
  const labels = language === "ja" ? [
    "順位", "都市", "国", "通貨", "年間総収入", "月間総収入", "年間税額", "年間社会保険", "年間手取り（本人）", "月間手取り（本人）", "収支の基準", "世帯の年間手取り", "月額家賃", "食費", "光熱費", "光熱費の扱い", "通信費", "交通費", "医療費目安", "その他生活費", "カスタム支出合計", "家賃以外の月額支出", "月間生活費", "月間余剰", "年間貯蓄", "貯蓄率", "家賃負担率", "生活費負担率", "購買力指数", "5年後資産", "10年後資産", "FIREまでの年数", "LifeAtlas Score", "データ信頼度", "計算状態", "都市データ更新日",
  ] : [
    "Rank", "City", "Country", "Currency", "Gross annual income", "Gross monthly income", "Annual tax", "Annual social insurance", "Net annual income (you)", "Net monthly income (you)", "Cash-flow basis", "Household net annual income", "Monthly rent", "Food", "Utilities", "Utilities basis", "Internet", "Transportation", "Healthcare estimate", "Other living costs", "Custom spending total", "Other monthly spending", "Monthly living cost", "Monthly surplus", "Annual savings", "Savings rate", "Rent burden", "Living-cost burden", "Purchasing power index", "Projected wealth in 5 years", "Projected wealth in 10 years", "Years to FIRE", "LifeAtlas Score", "Data confidence", "Calculation status", "City data updated",
  ];
  const scoreById = new Map(snapshot.scores.map((score) => [score.scenarioId, score]));
  const rows = snapshot.results.map((result) => {
    const score = scoreById.get(result.scenarioId);
    const city = cities[result.cityId];
    const localized = localizedCity(city, language);
    return [
      score?.rank,
      localized.name,
      localized.country,
      result.currency,
      result.grossAnnual,
      result.grossMonthly,
      result.taxAnnual,
      result.socialInsuranceAnnual,
      result.netAnnual,
      result.netMonthly,
      cashflowBasisLabels[result.cashflow.basis][language],
      result.cashflow.basis === "household" ? result.cashflow.netAnnual : null,
      result.rentMonthly,
      result.costBreakdownMonthly.food,
      result.costBreakdownMonthly.utilities,
      utilitiesBasisLabels[result.costBreakdownMonthly.utilitiesBasis][language],
      result.costBreakdownMonthly.internet,
      result.costBreakdownMonthly.transportation,
      result.costBreakdownMonthly.healthcare,
      result.costBreakdownMonthly.leisure,
      result.costBreakdownMonthly.customOther,
      result.baselineSpendingMonthly,
      result.totalLivingCostMonthly,
      result.monthlySurplus,
      result.annualSavings,
      result.savingsRate,
      result.rentBurden,
      result.livingCostBurden,
      result.purchasingPowerIndex,
      result.projectedSavings5Years,
      result.projectedSavings10Years,
      result.fire?.yearsToTarget,
      score?.score,
      result.dataConfidence.score,
      result.calculationStatus,
      city.updatedAt,
    ].map(csvCell).join(",");
  });
  const breakEvenLabels = language === "ja"
    ? ["逆転給与", "基準シナリオ", "候補シナリオ", "指標", "状態", "必要な年間給与", "通貨"]
    : ["Break-even salary", "Reference scenario", "Candidate scenario", "Metric", "Status", "Required annual salary", "Currency"];
  const breakEvenRows = snapshot.breakEven.map((result) => [
    "",
    result.referenceScenarioId,
    result.candidateScenarioId,
    result.metric,
    result.status,
    result.requiredAnnualSalary,
    result.salaryCurrency,
  ].map(csvCell).join(","));
  const disclaimer = language === "ja"
    ? "LifeAtlasの比較用概算であり、税務・金融・移住の専門助言ではありません。重要な判断では最新の公式情報と専門家をご確認ください。"
    : "LifeAtlas provides comparison estimates, not professional tax, financial or immigration advice. Confirm important decisions with current official sources and qualified professionals.";

  return [
    labels.map(csvCell).join(","),
    ...rows,
    "",
    breakEvenLabels.map(csvCell).join(","),
    ...breakEvenRows,
    "",
    [csvCell(language === "ja" ? "注意事項" : "Disclaimer"), csvCell(disclaimer)].join(","),
    "",
    [csvCell(language === "ja" ? "保存条件" : "Saved conditions"), csvCell(JSON.stringify(analysis.whatIf))].join(","),
  ].join("\r\n");
}
