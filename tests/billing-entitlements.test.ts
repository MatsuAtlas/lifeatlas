import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateScenario,
  canSaveUnlimitedComparisons,
  entitlementsForTier,
  isProStatus,
  tierForStatus,
} from "../lib/billing/entitlements.ts";
import { PUBLIC_BILLING_PLANS, PUBLIC_ONE_TIME_PRODUCTS } from "../lib/billing/plans.ts";

test("keeps Free and Pro feature limits in one entitlement contract", () => {
  const free = entitlementsForTier("free");
  const pro = entitlementsForTier("pro");

  assert.equal(free.maxScenarios, 2);
  assert.equal(free.maxSavedComparisons, 1);
  assert.equal(free.canUseWhatIf, false);
  assert.equal(canCreateScenario(free, 1), true);
  assert.equal(canCreateScenario(free, 2), false);

  assert.equal(pro.maxScenarios, 5);
  assert.equal(pro.maxSavedComparisons, null);
  assert.equal(pro.canUseWhatIf, true);
  assert.equal(pro.canUseBreakEven, true);
  assert.equal(canSaveUnlimitedComparisons(pro), true);
});

test("grants Pro only for active or trialing server-verified subscriptions", () => {
  assert.equal(isProStatus("active"), true);
  assert.equal(isProStatus("trialing"), true);
  assert.equal(isProStatus("past_due"), false);
  assert.equal(isProStatus("canceled"), false);
  assert.equal(tierForStatus("active"), "pro");
  assert.equal(tierForStatus("unpaid"), "free");
});

test("keeps subscription pricing configurable and prepares the one-time report separately", () => {
  assert.equal(PUBLIC_BILLING_PLANS.month.amountUsd, 12);
  assert.equal(PUBLIC_BILLING_PLANS.year.amountUsd, 79);
  assert.equal(PUBLIC_ONE_TIME_PRODUCTS.decisionReport.kind, "one-time");
  assert.equal(PUBLIC_ONE_TIME_PRODUCTS.decisionReport.availability, "planned");
  assert.deepEqual(PUBLIC_ONE_TIME_PRODUCTS.decisionReport.targetAmountUsd, [39, 49]);
});
