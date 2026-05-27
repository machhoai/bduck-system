/**
 * Safe Condition Evaluator — NO eval() / NO new Function()
 *
 * ═══════════════════════════════════════════════════════════════
 * SECURITY: Uses a whitelist-based operator map (ConditionOperator enum).
 * The engine extracts the target field from the entity payload using
 * dot-notation path traversal (e.g., "items.0.quantity"),
 * then compares it against the configured value.
 *
 * SUPPORTED OPERATORS:
 *   EQ, NEQ          → strict equality / inequality (supports string, number, boolean)
 *   GT, GTE, LT, LTE → numeric comparison (coerces to Number)
 *   CONTAINS          → substring / array-includes check
 *   NOT_CONTAINS      → negation of CONTAINS
 *
 * FIELD PATH SAFETY:
 *   - Only allows alphanumeric, underscores, dots, and array indices
 *   - Blocks __proto__, constructor, prototype (prototype pollution)
 *   - Max depth: 10 levels
 * ═══════════════════════════════════════════════════════════════
 */

import { ConditionOperator } from "@bduck/shared-types";

/** Regex whitelist for safe field paths: letters, numbers, dots, underscores */
const SAFE_FIELD_PATH = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;

/** Forbidden path segments (prototype pollution defense) */
const FORBIDDEN_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const MAX_DEPTH = 10;

/**
 * Safely traverse a nested object by dot-notation path.
 *
 * @example
 *   getFieldValue({ items: [{ qty: 5 }] }, "items.0.qty") → 5
 *   getFieldValue({ status: "APPROVED" }, "status") → "APPROVED"
 */
function getFieldValue(
  obj: Record<string, unknown>,
  fieldPath: string,
): unknown {
  if (!SAFE_FIELD_PATH.test(fieldPath)) {
    throw new Error(`Unsafe field path: "${fieldPath}"`);
  }

  const segments = fieldPath.split(".");

  if (segments.length > MAX_DEPTH) {
    throw new Error(
      `Field path exceeds max depth (${MAX_DEPTH}): "${fieldPath}"`,
    );
  }

  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new Error(`Forbidden field path segment: "${segment}"`);
    }
  }

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Evaluate a condition node against an entity's data payload.
 *
 * @param entityData — The voucher/entity's full data payload (from Firestore).
 * @param field      — Dot-notation path to the field to evaluate.
 * @param operator   — One of the 8 ConditionOperator enum values.
 * @param value      — The comparison value configured by the admin.
 * @returns boolean  — true → follow "true" edge, false → follow "false" edge.
 */
export function evaluateCondition(
  entityData: Record<string, unknown>,
  field: string,
  operator: ConditionOperator,
  value: unknown,
): boolean {
  const fieldValue = getFieldValue(entityData, field);

  switch (operator) {
    case ConditionOperator.EQ:
      return fieldValue === value;

    case ConditionOperator.NEQ:
      return fieldValue !== value;

    case ConditionOperator.GT:
      return toNumber(fieldValue) > toNumber(value);

    case ConditionOperator.GTE:
      return toNumber(fieldValue) >= toNumber(value);

    case ConditionOperator.LT:
      return toNumber(fieldValue) < toNumber(value);

    case ConditionOperator.LTE:
      return toNumber(fieldValue) <= toNumber(value);

    case ConditionOperator.CONTAINS:
      return checkContains(fieldValue, value);

    case ConditionOperator.NOT_CONTAINS:
      return !checkContains(fieldValue, value);

    default: {
      // Exhaustive check — TypeScript will flag unhandled operators
      const _exhaustive: never = operator;
      throw new Error(`Unknown operator: ${_exhaustive}`);
    }
  }
}

/**
 * Safe numeric coercion: returns NaN for non-numeric inputs.
 * NaN comparisons always return false, which is the safe default.
 */
function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  return NaN;
}

/**
 * Check if fieldValue "contains" the target value.
 * - If fieldValue is a string → substring check (case-insensitive)
 * - If fieldValue is an array → includes check
 * - Otherwise → false
 */
function checkContains(fieldValue: unknown, target: unknown): boolean {
  if (typeof fieldValue === "string" && typeof target === "string") {
    return fieldValue.toLowerCase().includes(target.toLowerCase());
  }

  if (Array.isArray(fieldValue)) {
    return fieldValue.includes(target);
  }

  return false;
}
