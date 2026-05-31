"use client";

/**
 * useApprovalApi — FE HTTP client for approval endpoints
 *
 * REPLACES: /api/workflows/engine/complete-task
 *
 * NEW ENDPOINTS:
 *   POST /api/approvals/:id/approve
 *   POST /api/approvals/:id/reject
 *   GET  /api/process-configs
 *   GET  /api/process-configs/:entityType
 *   PUT  /api/process-configs/:id
 *   POST /api/process-configs/seed/:entityType
 */

import { emitDataMutation } from "@/lib/dataInvalidation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

async function approvalApi<T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/approvals${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    const error = new Error(
      body?.messages?.vi || "Lỗi khi xử lý phê duyệt.",
    ) as Error & {
      statusCode?: number;
      messages?: { vi: string; zh: string };
    };
    error.statusCode = response.status;
    error.messages = body?.messages as { vi: string; zh: string };
    throw error;
  }

  if (method !== "GET") {
    emitDataMutation(["pending_approvals", "import_vouchers", "audit_logs"]);
  }

  return body.data as T;
}

async function configApi<T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/process-configs${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Lỗi khi xử lý cấu hình quy trình.");
  }

  return body.data as T;
}

// ─────────────────────────────────────────────
// APPROVAL ACTIONS
// ─────────────────────────────────────────────

export async function approveRecord(
  approvalId: string,
  comments?: string,
): Promise<{ allApproved: boolean; levelCompleted: boolean }> {
  return approvalApi(`/${approvalId}/approve`, "POST", { comments });
}

export async function rejectRecord(
  approvalId: string,
  reason: string,
): Promise<void> {
  return approvalApi(`/${approvalId}/reject`, "POST", { reason });
}

// ─────────────────────────────────────────────
// PROCESS CONFIG
// ─────────────────────────────────────────────

export async function fetchAllConfigs() {
  return configApi("/", "GET");
}

export async function fetchConfigByEntityType(
  entityType: string,
  warehouseId?: string,
) {
  const qs = warehouseId ? `?warehouse_id=${warehouseId}` : "";
  return configApi(`/${entityType}${qs}`, "GET");
}

export async function updateProcessConfig(configId: string, payload: unknown) {
  const result = await configApi(`/${configId}`, "PUT", payload);
  emitDataMutation(["process_configs"]);
  return result;
}

export async function seedProcessConfig(entityType: string) {
  const result = await configApi(`/seed/${entityType}`, "POST");
  emitDataMutation(["process_configs"]);
  return result;
}

export async function reseedProcessConfig(entityType: string) {
  const result = await configApi(`/reseed/${entityType}`, "POST");
  emitDataMutation(["process_configs"]);
  return result;
}
