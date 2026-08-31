export type BillingTier = "free" | "pro";
export type BillingInterval = "month" | "year";
export type BillingStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type Entitlements = {
  tier: BillingTier;
  maxScenarios: number;
  maxSavedComparisons: number | null;
  aiDailyLimit: number;
  canUseAI: boolean;
  canUseWhatIf: boolean;
  canUseBreakEven: boolean;
  canUseLongTermProjections: boolean;
  canUseFamilyScenarios: boolean;
  canUseCustomAssumptions: boolean;
  canShareResults: boolean;
  canDownloadResults: boolean;
};

export type BillingSubscription = {
  tier: BillingTier;
  status: BillingStatus;
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export type BillingStatusResponse = {
  configured: boolean;
  subscription: BillingSubscription;
  entitlements: Entitlements;
};
