/**
 * System Action Registry — HashMap-based dispatcher
 *
 * ═══════════════════════════════════════════════════════════════
 * SECURITY: No eval(), no dynamic imports. Handlers are registered
 * at module load time via a plain Map<string, Handler>.
 *
 * IDEMPOTENCY: Each handler receives the entityPayload and must
 * check if the action was already performed (e.g., status already
 * changed) before executing.
 *
 * AUDIT: Every handler writes to audit_logs (ISO 9001).
 *
 * ERROR HANDLING (v2):
 * - Handler THROWS → SystemActionError is re-thrown to engine
 *   → engine marks task FAILED, stops DAG, logs error.
 * - Handler returns { skipped: true } → soft skip, DAG continues.
 * - Handler returns { success: true } → normal success.
 * - No handler registered → returns { skipped: true }.
 * ═══════════════════════════════════════════════════════════════
 */

import { changeVoucherStatus } from "./actions/changeVoucherStatus.js";
import { updateInventoryATP } from "./actions/updateInventoryATP.js";
import { createNonconformity } from "./actions/createNonconformity.js";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface SystemActionContext {
  /** Workflow instance ID */
  instanceId: string;
  /** Entity payload passed through the DAG (voucher data, etc.) */
  entityPayload: Record<string, unknown>;
  /** User who triggered the workflow (or "SYSTEM" for auto-actions) */
  userId: string;
}

export type SystemActionResult = Record<string, unknown>;

export type SystemActionHandler = (
  params: Record<string, unknown>,
  ctx: SystemActionContext,
) => Promise<SystemActionResult>;

/**
 * Typed error for system action failures.
 * Thrown by executeSystemAction when a handler crashes.
 * The workflow engine catches this to decide task status.
 */
export class SystemActionError extends Error {
  actionType: string;
  cause: unknown;

  constructor(actionType: string, cause: unknown) {
    const msg =
      cause instanceof Error ? cause.message : String(cause);
    super(`[SystemAction:${actionType}] ${msg}`);
    this.name = "SystemActionError";
    this.actionType = actionType;
    this.cause = cause;
  }
}

// ─────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────

const registry = new Map<string, SystemActionHandler>();

/** Register a handler at boot time */
function registerAction(
  actionType: string,
  handler: SystemActionHandler,
): void {
  if (registry.has(actionType)) {
    console.warn(
      `[systemActionRegistry] Overwriting handler for: ${actionType}`,
    );
  }
  registry.set(actionType, handler);
}

// ─────────────────────────────────────────────
// BOOT-TIME REGISTRATION
// ─────────────────────────────────────────────

registerAction("CHANGE_VOUCHER_STATUS", changeVoucherStatus);
registerAction("UPDATE_INVENTORY_ATP", updateInventoryATP);
// Backward compat: old workflow definitions used "UPDATE_INVENTORY" (no _ATP suffix)
registerAction("UPDATE_INVENTORY", updateInventoryATP);
registerAction("CREATE_NONCONFORMITY", createNonconformity);

// ─────────────────────────────────────────────
// PUBLIC: Execute a system action by type
// ─────────────────────────────────────────────

/**
 * Look up and execute a registered system action handler.
 * Returns the handler result (merged into WorkflowTask.result).
 *
 * ERROR CONTRACT:
 * - No handler found → returns { skipped: true } (safe, forward-compat)
 * - Handler throws   → re-throws as SystemActionError
 *   (engine must catch and handle — mark task FAILED)
 * - Handler returns  → result is returned as-is with success flag
 */
export async function executeSystemAction(
  actionType: string,
  params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const handler = registry.get(actionType);

  if (!handler) {
    console.warn(
      `[systemActionRegistry] No handler for action_type="${actionType}". Skipping.`,
    );
    return {
      action_type: actionType,
      skipped: true,
      reason: "no_handler_registered",
    };
  }

  try {
    const result = await handler(params, ctx);
    return { action_type: actionType, success: true, ...result };
  } catch (error) {
    console.error(
      `[systemActionRegistry] Handler "${actionType}" FAILED:`,
      error,
    );
    // Re-throw as typed error so the engine can mark the task as FAILED
    throw new SystemActionError(actionType, error);
  }
}
