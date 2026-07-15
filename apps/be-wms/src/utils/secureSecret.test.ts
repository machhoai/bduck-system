import assert from "node:assert/strict";
import test from "node:test";
import { hasNonEmptySecret, securelyMatchesSecret } from "./secureSecret.js";

test("accepts only non-empty configured secrets", () => {
  assert.equal(hasNonEmptySecret(undefined), false);
  assert.equal(hasNonEmptySecret(""), false);
  assert.equal(hasNonEmptySecret("   "), false);
  assert.equal(hasNonEmptySecret("configured-secret"), true);
});

test("matches exact secrets and rejects empty or different values", () => {
  assert.equal(securelyMatchesSecret("secret-a", "secret-a"), true);
  assert.equal(securelyMatchesSecret("secret-a", "secret-b"), false);
  assert.equal(securelyMatchesSecret("", ""), false);
  assert.equal(securelyMatchesSecret(undefined, "secret-a"), false);
});
