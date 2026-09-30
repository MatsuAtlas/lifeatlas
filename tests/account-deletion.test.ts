import assert from "node:assert/strict";
import test from "node:test";

import { isAccountDeletionConfirmed, stripeCleanupFor } from "../lib/account/deletion.ts";
import { contactForDisplay, PROVISIONAL_CONTACT_EMAIL, publicContactEmail } from "../lib/legal/contact.ts";

test("account deletion requires the exact confirmation word", () => {
  assert.equal(isAccountDeletionConfirmed("削除"), true);
  assert.equal(isAccountDeletionConfirmed(" DELETE "), true);
  assert.equal(isAccountDeletionConfirmed("delete"), false);
  assert.equal(isAccountDeletionConfirmed(""), false);
  assert.equal(isAccountDeletionConfirmed(undefined), false);
});

test("a Stripe customer is removed before the account, and deletion stops if Stripe is unavailable", () => {
  assert.deepEqual(stripeCleanupFor(null, true), { action: "none" });
  assert.deepEqual(stripeCleanupFor({ stripe_customer_id: "cus_123" }, true), { action: "deleteCustomer", customerId: "cus_123" });
  assert.deepEqual(stripeCleanupFor({ stripe_customer_id: "cus_123" }, false), { action: "blocked" });
});

test("the public contact email is shown only when the owner has set a valid address", () => {
  assert.equal(publicContactEmail({}), null);
  assert.equal(publicContactEmail({ LIFEATLAS_CONTACT_EMAIL: "not an email" }), null);
  assert.equal(publicContactEmail({ LIFEATLAS_CONTACT_EMAIL: " support@example.com " }), "support@example.com");
});

test("until the owner sets an address, a clearly provisional reserved-domain address is shown", () => {
  assert.deepEqual(contactForDisplay({}), { email: PROVISIONAL_CONTACT_EMAIL, provisional: true });
  assert.ok(PROVISIONAL_CONTACT_EMAIL.endsWith(".example"));
  assert.deepEqual(contactForDisplay({ LIFEATLAS_CONTACT_EMAIL: "support@example.com" }), { email: "support@example.com", provisional: false });
});
