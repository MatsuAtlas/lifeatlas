import { cities } from "../../data/cities.ts";
import { convertCurrency, FALLBACK_FX_TO_JPY } from "../../data/currencies.ts";
import type { AgeBand, HouseholdType } from "../../types/finance";
import type { DataConfidence, ScenarioCalculationOptions, ScenarioInput, ScenarioResult } from "../../types/scenario";
import { calculateCity } from "./legacy-engine.ts";

export const CALCULATION_VERSION = "2026.08-v2.1";

function assertFiniteInRange(name: string, value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

export function ageBandFor(age: number): AgeBand {
  assertFiniteInRange("age", age, 18, 100);
  if (age < 40) return "under40";
  if (age < 65) return "40to64";
  return "65plus";
}

export function householdModelFor(input: Pick<ScenarioInput, "householdType" | "children">): HouseholdType {
  if (!Number.isInteger(input.children) || input.children < 0 || input.children > 10) {
    throw new RangeError("children must be an integer between 0 and 10.");
  }
  if (input.householdType === "single") return input.children === 0 ? "single" : "singleParent";
  if (input.children === 0) return "couple";
  if (input.children === 1) return "coupleOneChild";
  if (input.children === 2) return "family";
  return "familyThreeChildren";
}

export function projectSavings(currentSavings: number, annualSavings: number, years: number, annualReturnRate = 0) {
  assertFiniteInRange("years", years, 0, 100);
  assertFiniteInRange("annualReturnRate", annualReturnRate, -0.5, 0.5);
  let balance = currentSavings;
  for (let year = 0; year < years; year += 1) balance = balance * (1 + annualReturnRate) + annualSavings;
  return balance;
}

function yearsToWealthTarget(currentSavings: number, annualSavings: number, target: number, annualReturnRate: number) {
  if (currentSavings >= target) return 0;
  if (annualSavings <= 0 && annualReturnRate <= 0) return null;
  let balance = currentSavings;
  for (let year = 1; year <= 100; year += 1) {
    balance = balance * (1 + annualReturnRate) + annualSavings;
    if (balance >= target) return year;
    if (balance < 0 && annualSavings <= 0) return null;
  }
  return null;
}

function livingCostConfidence(cityId: keyof typeof cities) {
  const city = cities[cityId];
  const estimated = city.dataSources.some((source) => /Life Atlas|推定|保存参考値/i.test(source.source));
  return estimated ? 0.55 : 0.78;
}

function dataConfidence(
  cityId: keyof typeof cities,
  calculationStatus: ScenarioResult["calculationStatus"],
  exchangeRateStatus: "live" | "fallback",
): DataConfidence {
  const tax = calculationStatus === "official-scenario" ? 0.95 : calculationStatus === "official-rate-estimate" ? 0.82 : 0.2;
  const livingCost = livingCostConfidence(cityId);
  const exchangeRate = cities[cityId].currency === "JPY" ? 1 : exchangeRateStatus === "live" ? 0.9 : 0.55;
  const score = Math.round((tax * 0.45 + livingCost * 0.35 + exchangeRate * 0.2) * 100);
  const reasons = [
    calculationStatus === "unavailable" ? "tax:unavailable" : `tax:${calculationStatus}`,
    livingCost < 0.7 ? "living-cost:estimated" : "living-cost:sourced",
    exchangeRateStatus === "live" ? "fx:live" : "fx:fallback",
  ];
  return { score, level: score >= 80 ? "high" : score >= 60 ? "medium" : "low", tax, livingCost, exchangeRate, reasons };
}

export function calculateScenario(input: ScenarioInput, options: ScenarioCalculationOptions = {}): ScenarioResult {
  const city = cities[input.cityId];
  if (!city) throw new RangeError("Unknown cityId.");
  if (!input.id.trim()) throw new RangeError("id must not be empty.");
  if (input.householdType !== "single" && input.householdType !== "couple") throw new RangeError("Unknown householdType.");
  assertFiniteInRange("annualSalary", input.annualSalary, 0, 1_000_000_000_000);
  assertFiniteInRange("bonus", input.bonus ?? 0, 0, 1_000_000_000_000);
  assertFiniteInRange("customRent", input.customRent ?? 0, 0, 1_000_000_000_000);
  assertFiniteInRange("customMonthlySpending", input.customMonthlySpending ?? 0, 0, 1_000_000_000_000);
  assertFiniteInRange("customSavingsTarget", input.customSavingsTarget ?? 0, 0, 10_000_000_000_000);
  assertFiniteInRange("currentSavings", input.currentSavings ?? 0, 0, 10_000_000_000_000);
  const ageBand = ageBandFor(input.age);
  assertFiniteInRange("retirementAge", input.retirementAge ?? 65, input.age, 100);

  const annualReturnRate = input.annualReturnRate ?? 0;
  assertFiniteInRange("annualReturnRate", annualReturnRate, -0.5, 0.5);
  const householdModel = householdModelFor(input);
  const ratesToJpy = options.ratesToJpy ?? FALLBACK_FX_TO_JPY;
  if (!Number.isFinite(ratesToJpy[input.salaryCurrency]) || ratesToJpy[input.salaryCurrency] <= 0) throw new RangeError("Missing salary currency rate.");
  if (!Number.isFinite(ratesToJpy[city.currency]) || ratesToJpy[city.currency] <= 0) throw new RangeError("Missing city currency rate.");
  const grossAnnual = convertCurrency(input.annualSalary + (input.bonus ?? 0), input.salaryCurrency, city.currency, ratesToJpy);
  const legacy = calculateCity(city, grossAnnual, householdModel, input.housing, input.lifestyle, ageBand);
  const rentMonthly = input.customRent ?? legacy.rent;
  const baselineSpendingMonthly = input.customMonthlySpending ?? legacy.livingCosts;
  const totalLivingCostMonthly = rentMonthly + baselineSpendingMonthly;
  const totalLivingCostAnnual = totalLivingCostMonthly * 12;
  const netMonthly = legacy.netMonthly;
  const netAnnual = netMonthly === null ? null : netMonthly * 12;
  const monthlySurplus = netMonthly === null ? null : netMonthly - totalLivingCostMonthly;
  const annualSavings = monthlySurplus === null ? null : monthlySurplus * 12;
  const savingsRate = annualSavings === null || netAnnual === null || netAnnual <= 0 ? null : (annualSavings / netAnnual) * 100;
  const rentBurden = netMonthly === null || netMonthly <= 0 ? null : (rentMonthly / netMonthly) * 100;
  const livingCostBurden = netMonthly === null || netMonthly <= 0 ? null : (totalLivingCostMonthly / netMonthly) * 100;
  const purchasingPowerIndex = netMonthly === null || totalLivingCostMonthly <= 0 ? null : Math.round((netMonthly / totalLivingCostMonthly) * 100);
  const currentSavings = input.currentSavings ?? 0;
  const projectedSavings5Years = annualSavings === null ? null : projectSavings(currentSavings, annualSavings, 5, annualReturnRate);
  const projectedSavings10Years = annualSavings === null ? null : projectSavings(currentSavings, annualSavings, 10, annualReturnRate);
  const fireTarget = totalLivingCostAnnual * 25;
  const fireYears = annualSavings === null ? null : yearsToWealthTarget(currentSavings, annualSavings, fireTarget, annualReturnRate);
  const retirementAge = input.retirementAge ?? 65;
  const savingsTargetYears = annualSavings === null || input.customSavingsTarget === undefined
    ? null
    : yearsToWealthTarget(currentSavings, annualSavings, input.customSavingsTarget, annualReturnRate);
  const confidence = dataConfidence(input.cityId, legacy.taxCalculationStatus, options.exchangeRateStatus ?? "fallback");

  return {
    scenarioId: input.id,
    cityId: input.cityId,
    currency: city.currency,
    grossAnnual,
    grossMonthly: grossAnnual / 12,
    taxAnnual: legacy.taxBreakdown === null ? null : legacy.taxBreakdown.totalTaxMonthly * 12,
    socialInsuranceAnnual: legacy.taxBreakdown === null ? null : legacy.taxBreakdown.totalInsuranceMonthly * 12,
    taxBreakdown: legacy.taxBreakdown,
    netAnnual,
    netMonthly,
    rentMonthly,
    baselineSpendingMonthly,
    totalLivingCostMonthly,
    totalLivingCostAnnual,
    monthlySurplus,
    annualSavings,
    savingsRate,
    rentBurden,
    livingCostBurden,
    purchasingPowerIndex,
    annualSavingsJpy: annualSavings === null ? null : convertCurrency(annualSavings, city.currency, "JPY", ratesToJpy),
    netAnnualJpy: netAnnual === null ? null : convertCurrency(netAnnual, city.currency, "JPY", ratesToJpy),
    projectedSavings5Years,
    projectedSavings10Years,
    savingsTargetYears,
    fire: annualSavings === null ? null : {
      annualLivingCost: totalLivingCostAnnual,
      targetWealth: fireTarget,
      yearsToTarget: fireYears,
      targetAge: fireYears === null ? null : input.age + fireYears,
      reachesBeforeRetirementAge: fireYears === null ? null : input.age + fireYears <= retirementAge,
    },
    dataConfidence: confidence,
    calculationStatus: legacy.taxCalculationStatus,
    unavailableReason: legacy.calculationUnavailableReason,
    assumptions: {
      ageBand,
      householdModel,
      annualReturnRate,
      projectionYears: [5, 10],
      calculationVersion: CALCULATION_VERSION,
    },
  };
}
