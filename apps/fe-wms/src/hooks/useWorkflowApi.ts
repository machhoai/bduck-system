"use client";

import { emitDataMutation } from "@/lib/dataInvalidation";

/**
 * Workflow API Service — FE HTTP client for workflow endpoints.
 *
 * Follows the project pattern from useWarehouses.ts / useProducts.ts:
 * - Uses process.env.NEXT_PUBLIC_API_URL
 * - Sends credentials: "include" for cookie-based session auth
 * - Returns parsed JSON body
 * - Throws Error with vi message for toast consumption
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

async function workflowApi<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/workflows${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Lỗi khi xử lý quy trình.");
  }

  if (method !== "GET") {
    emitDataMutation(["workflow_definitions", "workflow_tasks", "audit_logs"]);
  }

  return body.data as T;
}

// ─────────────────────────────────────────────
// DEFINITION CRUD
// ─────────────────────────────────────────────

export async function fetchWorkflowDefinitions() {
  return workflowApi("/", "GET");
}

export async function fetchWorkflowDefinitionById(id: string) {
  return workflowApi(`/${id}`, "GET");
}

export async function createWorkflowDefinition(data: {
  name: string;
  description?: string | null;
  entity_type: string;
  scope_warehouse_ids?: string[] | null;
}) {
  return workflowApi("/", "POST", data);
}

export async function updateWorkflowDefinition(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    entity_type: string;
    scope_warehouse_ids: string[] | null;
  }>,
) {
  return workflowApi(`/${id}`, "PUT", data);
}

export async function archiveWorkflowDefinition(id: string) {
  return workflowApi(`/${id}`, "DELETE");
}

// ─────────────────────────────────────────────
// VERSIONS
// ─────────────────────────────────────────────

/**
 * Serialize the React Flow canvas state into the Zod-validated format
 * and send to the BE to create a new immutable DAG version.
 */
export async function saveWorkflowVersion(
  definitionId: string,
  dag: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      source_handle: string | null;
      label: string | null;
    }>;
  },
) {
  return workflowApi(`/${definitionId}/versions`, "POST", dag);
}

export async function fetchWorkflowVersions(definitionId: string) {
  return workflowApi(`/${definitionId}/versions`, "GET");
}

/**
 * Publish a version → makes it the active DAG for the definition.
 */
export async function publishWorkflowVersion(
  definitionId: string,
  versionId: string,
) {
  return workflowApi(
    `/${definitionId}/versions/${versionId}/publish`,
    "POST",
  );
}
