import { createHash, timingSafeEqual } from "node:crypto";

export const hasNonEmptySecret = (
  value: string | null | undefined,
): value is string => typeof value === "string" && value.trim().length > 0;

/** Compares non-empty secrets using fixed-length hashes to avoid timing leaks. */
export const securelyMatchesSecret = (
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean => {
  if (!hasNonEmptySecret(provided) || !hasNonEmptySecret(expected)) {
    return false;
  }

  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
};
