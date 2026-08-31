import type { BillingStatus, BillingTier, Entitlements } from "../../types/billing";

export const FREE_ENTITLEMENTS: Entitlements = {
  tier: "free",
  maxScenarios: 2,
  maxSavedComparisons: 1,
  aiDailyLimit: 3,
  canUseAI: true,
  canUseWhatIf: false,
  canUseBreakEven: false,
  canUseLongTermProjections: false,
  canUseFamilyScenarios: false,
  canUseCustomAssumptions: false,
  canShareResults: false,
  canDownloadResults: false,
};

export const PRO_ENTITLEMENTS: Entitlements = {
  tier: "pro",
  maxScenarios: 5,
  maxSavedComparisons: null,
  aiDailyLimit: 100,
  canUseAI: true,
  canUseWhatIf: true,
  canUseBreakEven: true,
  canUseLongTermProjections: true,
  canUseFamilyScenarios: true,
  canUseCustomAssumptions: true,
  canShareResults: true,
  canDownloadResults: true,
};

export function isProStatus(status: BillingStatus) {
  return status === "active" || status === "trialing";
}

export function tierForStatus(status: BillingStatus): BillingTier {
  return isProStatus(status) ? "pro" : "free";
}

export function entitlementsForTier(tier: BillingTier): Entitlements {
  return tier === "pro" ? { ...PRO_ENTITLEMENTS } : { ...FREE_ENTITLEMENTS };
}

export function canCreateScenario(entitlements: Entitlements, currentCount: number) {
  return Number.isInteger(currentCount) && currentCount >= 0 && currentCount < entitlements.maxScenarios;
}

export function canUseAI(entitlements: Entitlements) {
  return entitlements.canUseAI;
}

export function canUseBreakEven(entitlements: Entitlements) {
  return entitlements.canUseBreakEven;
}

export function canUseWhatIf(entitlements: Entitlements) {
  return entitlements.canUseWhatIf;
}

export function canSaveUnlimitedComparisons(entitlements: Entitlements) {
  return entitlements.maxSavedComparisons === null;
}
