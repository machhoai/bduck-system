/**
 * Workflow Definition Service — CRUD + Version Management
 *
 * Business rules:
 * 1. Only ADMIN can create/edit/publish workflows.
 * 2. Publishing creates a new immutable WorkflowVersion from the saved DAG.
 * 3. current_version_id is set atomically with status → ACTIVE.
 * 4. DAG validation: each node's config is validated against its type-specific Zod schema.
 * 5. Structural validation: cycle detection, orphan detection, single trigger.
 */

import type { z } from "zod";
import type { WorkflowNode, WorkflowEdge } from "@bduck/shared-types";
import { WorkflowDefinitionStatus } from "@bduck/shared-types";
import * as repo from "../repositories/workflowRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { AuditAction } from "@bduck/shared-types";
import {
  type createWorkflowDefinitionSchema,
  type saveWorkflowVersionSchema,
  nodeConfigSchemaMap,
} from "../utils/zodSchemas.js";

type CreateInput = z.infer<typeof createWorkflowDefinitionSchema>;
type SaveVersionInput = z.infer<typeof saveWorkflowVersionSchema>;

/** Error with HTTP-friendly shape */
function apiError(vi: string, zh: string, statusCode = 400): never {
  throw { statusCode, messages: { vi, zh } };
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

export const createWorkflowDefinition = async (
  data: CreateInput,
  userId: string,
  meta: AuditMetadata,
) => {
  const definition = await repo.createDefinition({
    name: data.name,
    description: data.description ?? null,
    entity_type: data.entity_type as any,
    scope_warehouse_ids: data.scope_warehouse_ids ?? null,
    status: WorkflowDefinitionStatus.DRAFT,
    current_version_id: null,
    created_by: userId,
  });

  await logAudit({
    entity_type: "workflow_definitions",
    entity_id: definition.id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: definition as any,
    ...meta,
  });

  return definition;
};

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

export const updateWorkflowDefinition = async (
  id: string,
  data: Partial<CreateInput>,
  userId: string,
  meta: AuditMetadata,
) => {
  const existing = await repo.findDefinitionById(id);
  if (!existing || existing.is_deleted) {
    apiError("Quy trình không tồn tại.", "流程不存在。", 404);
  }

  await repo.updateDefinition(id, data as any);

  await logAudit({
    entity_type: "workflow_definitions",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as any,
    new_value: { ...existing, ...data } as any,
    ...meta,
  });
};

// ─────────────────────────────────────────────
// ARCHIVE (soft delete)
// ─────────────────────────────────────────────

export const archiveWorkflowDefinition = async (
  id: string,
  userId: string,
  meta: AuditMetadata,
) => {
  const existing = await repo.findDefinitionById(id);
  if (!existing || existing.is_deleted) {
    apiError("Quy trình không tồn tại.", "流程不存在。", 404);
  }

  await repo.softDeleteDefinition(id);

  await logAudit({
    entity_type: "workflow_definitions",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as any,
    new_value: { ...existing, is_deleted: true, status: "ARCHIVED" } as any,
    ...meta,
  });
};

// ─────────────────────────────────────────────
// SAVE DAG (creates a draft version)
// ─────────────────────────────────────────────

export const saveWorkflowDag = async (
  definitionId: string,
  dag: SaveVersionInput,
  userId: string,
  meta: AuditMetadata,
) => {
  const definition = await repo.findDefinitionById(definitionId);
  if (!definition || definition.is_deleted) {
    apiError("Quy trình không tồn tại.", "流程不存在。", 404);
  }

  // Validate each node config against its type-specific schema
  validateNodeConfigs(dag.nodes as WorkflowNode[]);

  // Validate DAG structure
  validateDagStructure(dag.nodes as WorkflowNode[], dag.edges as WorkflowEdge[]);

  const versionNumber = await repo.getNextVersionNumber(definitionId);

  const version = await repo.createVersion(definitionId, {
    workflow_definition_id: definitionId,
    version_number: versionNumber,
    nodes: dag.nodes as WorkflowNode[],
    edges: dag.edges as WorkflowEdge[],
    published_at: null,
    published_by: null,
  });

  await logAudit({
    entity_type: "workflow_versions",
    entity_id: version.id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: {
      workflow_definition_id: definitionId,
      version_number: version.version_number,
      node_count: version.nodes.length,
      edge_count: version.edges.length,
    },
    notes: `Saved draft workflow DAG v${version.version_number}`,
    ...meta,
  });

  return version;
};

// ─────────────────────────────────────────────
// PUBLISH VERSION → makes it the active DAG
// ─────────────────────────────────────────────

export const publishWorkflowVersion = async (
  definitionId: string,
  versionId: string,
  userId: string,
  meta: AuditMetadata,
) => {
  const definition = await repo.findDefinitionById(definitionId);
  if (!definition || definition.is_deleted) {
    apiError("Quy trình không tồn tại.", "流程不存在。", 404);
  }

  const version = await repo.findVersionById(definitionId, versionId);
  if (!version) {
    apiError("Phiên bản không tồn tại.", "版本不存在。", 404);
  }

  // Re-validate DAG before publishing (defense in depth)
  validateNodeConfigs(version.nodes);
  validateDagStructure(version.nodes, version.edges);

  // ── Deactivate competing definitions (same entity_type) ──
  // Ensures only ONE active workflow per entity_type to avoid
  // non-deterministic behavior in findActiveDefinitionForEntity.
  const allDefs = await repo.findDefinitions();
  const competing = allDefs.filter(
    (d) =>
      d.id !== definitionId &&
      d.entity_type === definition.entity_type &&
      d.status === WorkflowDefinitionStatus.ACTIVE,
  );

  // Atomically: deactivate old + set version published + update definition
  const db = repo.getDb();
  const batch = db.batch();

  // Deactivate competing definitions → DRAFT (not deleted, just inactive)
  for (const comp of competing) {
    const compRef = db.collection("workflow_definitions").doc(comp.id);
    batch.update(compRef, {
      status: WorkflowDefinitionStatus.DRAFT,
      updated_at: new Date(),
    });
  }

  // Update version with publish timestamp
  const versionRef = db
    .collection("workflow_definitions")
    .doc(definitionId)
    .collection("versions")
    .doc(versionId);
  batch.update(versionRef, {
    published_at: new Date(),
    published_by: userId,
  });

  // Update definition to point to this version + set ACTIVE
  const defRef = db.collection("workflow_definitions").doc(definitionId);
  batch.update(defRef, {
    current_version_id: versionId,
    status: WorkflowDefinitionStatus.ACTIVE,
    updated_at: new Date(),
  });

  await batch.commit();

  // Audit: deactivated competing definitions
  for (const comp of competing) {
    await logAudit({
      entity_type: "workflow_definitions",
      entity_id: comp.id,
      action: AuditAction.UPDATE,
      user_id: userId,
      old_value: { status: comp.status },
      new_value: { status: WorkflowDefinitionStatus.DRAFT },
      notes: `Auto-deactivated: new definition "${definition.name}" published for ${definition.entity_type}`,
      ...meta,
    });
  }

  await logAudit({
    entity_type: "workflow_definitions",
    entity_id: definitionId,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { current_version_id: definition.current_version_id },
    new_value: { current_version_id: versionId, status: "ACTIVE" },
    notes: `Published version v${version.version_number}` +
      (competing.length > 0
        ? ` — deactivated ${competing.length} competing definition(s)`
        : ""),
    ...meta,
  });
};

// ─────────────────────────────────────────────
// READ helpers
// ─────────────────────────────────────────────

export const fetchWorkflowDefinitions = repo.findDefinitions;
export const fetchWorkflowDefinitionById = repo.findDefinitionById;
export const fetchVersionsByDefinition = repo.findVersionsByDefinition;
export const fetchVersionById = repo.findVersionById;

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────

function validateNodeConfigs(nodes: WorkflowNode[]) {
  for (const node of nodes) {
    const schema = nodeConfigSchemaMap[node.type];
    if (!schema) {
      apiError(
        `Loại node không hợp lệ: ${node.type}`,
        `无效的节点类型: ${node.type}`,
      );
    }
    const result = schema.safeParse(node.config);
    if (!result.success) {
      apiError(
        `Cấu hình node "${node.label}" (${node.type}) không hợp lệ: ${result.error.message}`,
        `节点"${node.label}" (${node.type}) 配置无效: ${result.error.message}`,
      );
    }
  }
}

function validateDagStructure(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  // 1. Exactly 1 TRIGGER node
  const triggers = nodes.filter((n) => n.type === "TRIGGER");
  if (triggers.length === 0) {
    apiError(
      "DAG phải có ít nhất 1 node Trigger.",
      "DAG 必须至少有1个触发节点。",
    );
  }
  if (triggers.length > 1) {
    apiError(
      "DAG chỉ được có 1 node Trigger.",
      "DAG 只能有1个触发节点。",
    );
  }

  // 2. Cycle detection (DFS 3-color)
  const adj = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adj.get(e.source)!.push(e.target);
    }
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY);
    for (const neighbor of adj.get(nodeId) || []) {
      if (color.get(neighbor) === GRAY) return true;
      if (color.get(neighbor) === WHITE && dfs(neighbor)) return true;
    }
    color.set(nodeId, BLACK);
    return false;
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE && dfs(id)) {
      apiError(
        "DAG chứa vòng lặp (cycle). Quy trình không được phép có vòng lặp.",
        "DAG 包含循环。流程不允许出现循环。",
      );
    }
  }

  // 3. Orphan detection (BFS from trigger)
  const reachable = new Set<string>();
  const queue = [triggers[0].id];
  reachable.add(triggers[0].id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adj.get(current) || []) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  const orphans = nodes.filter((n) => !reachable.has(n.id));
  if (orphans.length > 0) {
    apiError(
      `Có ${orphans.length} node không được kết nối từ Trigger.`,
      `有 ${orphans.length} 个节点未从触发节点连接。`,
    );
  }
}
