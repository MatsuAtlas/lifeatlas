import assert from "node:assert/strict";
import test from "node:test";

import { isPublicLaunch, robotsRules } from "../lib/site-visibility.ts";

test("the site stays out of search engines until the owner sets LIFEATLAS_PUBLIC_LAUNCH=true", () => {
  assert.equal(isPublicLaunch({}), false);
  assert.equal(isPublicLaunch({ LIFEATLAS_PUBLIC_LAUNCH: "yes" }), false);
  assert.deepEqual(robotsRules({}).disallow.slice(0, 1), ["/"]);
  assert.equal(isPublicLaunch({ LIFEATLAS_PUBLIC_LAUNCH: "true" }), true);
  const launched = robotsRules({ LIFEATLAS_PUBLIC_LAUNCH: "true" });
  assert.equal("allow" in launched && launched.allow, "/");
  assert.equal(launched.disallow.includes("/"), false);
  assert.ok(launched.disallow.includes("/account"));
});
