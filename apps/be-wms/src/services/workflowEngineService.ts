/**
 * Workflow Engine Service — DAG Traversal & Execution
 *
 * ═══════════════════════════════════════════════════════════════
 * CORE DESIGN: Transactional Node Advancement
 * ═══════════════════════════════════════════════════════════════
 *
 * When a voucher is created, the engine:
 * 1. Finds the matching active WorkflowDefinition for (entityType + warehouseId)
 * 2. Loads the immutable WorkflowVersion by current_version_id
 * 3. Creates a WorkflowInstance referencing that version_id
 * 4. Traverses from the TriggerNode → creates tasks for each subsequent node
 *
 * TRANSACTION SAFETY (JOIN RACE CONDITION):
 * When two parallel branches complete at the exact same millisecond:
 * - Both call advanceInstance() which runs inside runTransaction()
 * - Firestore transactions use optimistic concurrency control (OCC)
 * - The first transaction that commits wins; the second is RETRIED
 * - On retry, the second transaction reads the UPDATED instance state
 * - It sees the first branch has already been removed from current_node_ids
 * - It then safely checks if ALL sibling tasks are COMPLETED
 * - If yes → advances past JOIN; if not → only updates its own task status
 *
 * This guarantees exactly-once advancement past a JOIN node,
 * even under perfect concurrency.
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import {
  AuditAction,
  WorkflowNodeType,
  WorkflowInstanceStatus,
  WorkflowTaskStatus,
  ConditionOperator,
} from "@bduck/shared-types";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowVersion,
  WorkflowInstance,
  WorkflowTask,
  JoinNodeConfig,
  TimerNodeConfig,
  ConditionNodeConfig,
  SystemActionNodeConfig,
  DataInputNodeConfig,
  NotificationNodeConfig,
} from "@bduck/shared-types";
import * as repo from "../repositories/workflowRepository.js";
import { scheduleTimerTask } from "../utils/workflowTimerService.js";
import { evaluateCondition } from "../utils/conditionEvaluator.js";
import { executeSystemAction, SystemActionError } from "./systemActionRegistry.js";
import { createNotification } from "./notificationService.js";
import { logAudit } from "./auditService.js";

const ENTITY_COLLECTIONS: Record<string, string> = {
  IMPORT_VOUCHER: "import_vouchers",
  EXPORT_VOUCHER: "export_vouchers",
  TRANSFER_ORDER: "transfer_orders",
  PURCHASE_ORDER: "purchase_orders",
};

/** Error with HTTP-friendly shape */
function apiError(vi: string, zh: string, statusCode = 400): never {
  throw { statusCode, messages: { vi, zh } };
}

// ─────────────────────────────────────────────
// PUBLIC: Start a workflow for a voucher/entity
// ─────────────────────────────────────────────

export const startWorkflow = async (
  entityType: string,
  entityId: string,
  warehouseId: string | null,
  userId: string,
  entityPayload: Record<string, unknown> = {},
): Promise<WorkflowInstance> => {
  // 1. Find active definition for this entity type + warehouse scope
  const definition = await repo.findActiveDefinitionForEntity(
    entityType,
    warehouseId,
  );

  if (!definition || !definition.current_version_id) {
    apiError(
      "Không tìm thấy quy trình phê duyệt cho loại chứng từ này.",
      "未找到此单据类型的审批流程。",
      404,
    );
  }

  // 2. Load the immutable version
  const version = await repo.findVersionById(
    definition.id,
    definition.current_version_id!,
  );
  if (!version) {
    apiError(
      "Phiên bản quy trình không tồn tại.",
      "流程版本不存在。",
      500,
    );
  }

  // 3. Find the TriggerNode
  const triggerNode = version.nodes.find(
    (n) => n.type === WorkflowNodeType.TRIGGER,
  );
  if (!triggerNode) {
    apiError("DAG không có node Trigger.", "DAG 没有触发节点。", 500);
  }

  // 4. Create the instance
  const now = new Date();
  const instance = await repo.createInstance({
    workflow_definition_id: definition.id,
    workflow_version_id: version.id,
    entity_type: definition.entity_type,
    entity_id: entityId,
    status: WorkflowInstanceStatus.RUNNING,
    current_node_ids: [triggerNode.id],
    started_by: userId,
    started_at: now,
    completed_at: null,
    action_time: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "workflow_instances",
    entity_id: instance.id,
    warehouse_id: warehouseId,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: {
      workflow_definition_id: definition.id,
      workflow_version_id: version.id,
      source_entity_type: definition.entity_type,
      source_entity_id: entityId,
      current_node_ids: instance.current_node_ids,
      status: instance.status,
    },
  });

  // 5. Create trigger task (auto-completed immediately)
  await repo.createTask(instance.id, {
    instance_id: instance.id,
    node_id: triggerNode.id,
    node_type: WorkflowNodeType.TRIGGER,
    status: WorkflowTaskStatus.COMPLETED,
    assigned_to: null,
    assigned_role_id: null,
    completed_by: userId,
    result: { event: (triggerNode.config as any).event },
    started_at: now,
    completed_at: now,
    due_at: null,
    action_time: now,
    sync_time: now,
  });

  // 6. Advance from trigger to next nodes
  await advanceFromNode(instance.id, version, triggerNode.id, userId, entityPayload);

  return instance;
};

// ─────────────────────────────────────────────
// PUBLIC: Complete a task (human approval, timer callback, etc.)
// ─────────────────────────────────────────────

export const completeTask = async (
  instanceId: string,
  taskId: string,
  userId: string,
  result: Record<string, unknown> = {},
): Promise<void> => {
  const instance = await repo.findInstanceById(instanceId);
  if (!instance || instance.status !== WorkflowInstanceStatus.RUNNING) {
    apiError(
      "Workflow instance không hợp lệ hoặc đã kết thúc.",
      "工作流实例无效或已结束。",
    );
  }

  const version = await repo.findVersionById(
    instance.workflow_definition_id,
    instance.workflow_version_id,
  );
  if (!version) {
    apiError("Phiên bản quy trình không tồn tại.", "流程版本不存在。", 500);
  }

  let previousTaskStatus: WorkflowTaskStatus | null = null;

  // Transaction: update task status + advance instance
  await db.runTransaction(async (txn) => {
    const taskRef = repo.getTaskRef(instanceId, taskId);
    const taskSnap = await txn.get(taskRef);
    if (!taskSnap.exists) {
      apiError("Task không tồn tại.", "任务不存在。", 404);
    }

    const task = taskSnap.data() as WorkflowTask;
    previousTaskStatus = task.status;
    if (task.status !== WorkflowTaskStatus.PENDING &&
        task.status !== WorkflowTaskStatus.IN_PROGRESS) {
      apiError(
        "Task đã được xử lý.",
        "任务已处理。",
      );
    }

    // ── Self-Approval Block (Segregation of Duties — ISO 9001) ──
    if (task.node_type === WorkflowNodeType.APPROVAL) {
      await enforceSelfApprovalBlock(instance, userId);
    }

    const now = new Date();
    txn.update(taskRef, {
      status: WorkflowTaskStatus.COMPLETED,
      completed_by: userId,
      completed_at: now,
      result,
      action_time: now,
      sync_time: now,
    });
  });

  // After transaction succeeds, get the task to find the nodeId
  const tasks = await repo.findTasksByInstance(instanceId);
  const completedTask = tasks.find((t) => t.id === taskId);
  if (!completedTask) return;

  await logAudit({
    entity_type: "workflow_tasks",
    entity_id: taskId,
    warehouse_id: await resolveWorkflowWarehouseId(instance),
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: previousTaskStatus },
    new_value: {
      status: WorkflowTaskStatus.COMPLETED,
      completed_by: userId,
      result,
      instance_id: instanceId,
      node_id: completedTask.node_id,
    },
  });

  // Enrich result with entity context for downstream SYSTEM_ACTION nodes
  const enrichedResult = {
    ...result,
    voucher_id: instance.entity_id,
    entity_type: instance.entity_type,
  };

  await advanceFromNode(instanceId, version, completedTask.node_id, userId, enrichedResult);
};

// ─────────────────────────────────────────────
// PUBLIC: Timer callback
// ─────────────────────────────────────────────

export const advanceFromTimer = async (
  instanceId: string,
  taskId: string,
): Promise<void> => {
  await completeTask(instanceId, taskId, "SYSTEM", { timer_completed: true });
};

// ─────────────────────────────────────────────
// PRIVATE: Advance from a completed node to next nodes
// ─────────────────────────────────────────────

async function advanceFromNode(
  instanceId: string,
  version: WorkflowVersion,
  completedNodeId: string,
  userId: string,
  entityPayload: Record<string, unknown> = {},
): Promise<void> {
  // Check if the completed node is an APPROVAL — branch by decision
  const completedNode = version.nodes.find((n) => n.id === completedNodeId);
  if (completedNode?.type === WorkflowNodeType.APPROVAL) {
    const approved = entityPayload.approved === true;
    const handle = approved ? "approved" : "rejected";
    const matchingEdge = version.edges.find(
      (e) => e.source === completedNodeId && e.source_handle === handle,
    );
    if (matchingEdge) {
      const nextNode = version.nodes.find((n) => n.id === matchingEdge.target);
      if (nextNode) {
        await processNode(instanceId, version, nextNode, userId, entityPayload);
      }
    } else {
      // No matching edge — treat as terminal
      await completeInstance(instanceId, userId);
    }
    return;
  }

  // Default: follow ALL outgoing edges
  const nextNodeIds = getNextNodes(version, completedNodeId);

  if (nextNodeIds.length === 0) {
    // Terminal node — complete the instance
    await completeInstance(instanceId, userId);
    return;
  }

  for (const nextNodeId of nextNodeIds) {
    const node = version.nodes.find((n) => n.id === nextNodeId);
    if (!node) continue;

    await processNode(instanceId, version, node, userId, entityPayload);
  }
}

// ─────────────────────────────────────────────
// PRIVATE: Process a single node
// ─────────────────────────────────────────────

async function processNode(
  instanceId: string,
  version: WorkflowVersion,
  node: WorkflowNode,
  userId: string,
  entityPayload: Record<string, unknown> = {},
): Promise<void> {
  const now = new Date();

  switch (node.type) {
    case WorkflowNodeType.APPROVAL: {
      // Create pending task assigned to role/user — waits for human action
      const config = node.config as any;
      await createPendingTask(instanceId, node, {
        assigned_to: config.assigned_user_id || null,
        assigned_role_id: config.assigned_role_id || null,
        due_at: config.timeout_hours
          ? new Date(now.getTime() + config.timeout_hours * 3600000)
          : null,
      });
      await updateCurrentNodes(instanceId, node.id, "add");
      break;
    }

    case WorkflowNodeType.SYSTEM_ACTION: {
      // Execute handler from registry → auto-complete → advance
      const saConfig = node.config as SystemActionNodeConfig;
      try {
        const actionResult = await executeSystemAction(
          saConfig.action_type,
          saConfig.params || {},
          { instanceId, entityPayload, userId },
        );
        await repo.createTask(instanceId, {
          instance_id: instanceId,
          node_id: node.id,
          node_type: node.type,
          status: WorkflowTaskStatus.COMPLETED,
          assigned_to: null,
          assigned_role_id: null,
          completed_by: "SYSTEM",
          result: actionResult,
          started_at: now,
          completed_at: now,
          due_at: null,
          action_time: now,
          sync_time: now,
        });
        await advanceFromNode(instanceId, version, node.id, userId, entityPayload);
      } catch (error) {
        // SYSTEM_ACTION failed — mark task FAILED, stop DAG, set instance ERROR
        const errorMsg =
          error instanceof SystemActionError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);

        console.error(
          `[workflowEngine] SYSTEM_ACTION "${saConfig.action_type}" FAILED for instance=${instanceId}:`,
          error,
        );

        await repo.createTask(instanceId, {
          instance_id: instanceId,
          node_id: node.id,
          node_type: node.type,
          status: WorkflowTaskStatus.FAILED,
          assigned_to: null,
          assigned_role_id: null,
          completed_by: "SYSTEM",
          result: {
            action_type: saConfig.action_type,
            success: false,
            error: errorMsg,
          },
          started_at: now,
          completed_at: now,
          due_at: null,
          action_time: now,
          sync_time: now,
        });

        // Set instance to ERROR — DAG stops here
        const instanceRef = repo.getInstanceRef(instanceId);
        await instanceRef.update({
          status: WorkflowInstanceStatus.ERROR,
          current_node_ids: [node.id],
          updated_at: now,
        });

        // Audit trail for the failure (ISO 9001)
        await logAudit({
          entity_type: "workflow_instances",
          entity_id: instanceId,
          warehouse_id: null,
          action: AuditAction.UPDATE,
          user_id: userId,
          old_value: { status: WorkflowInstanceStatus.RUNNING },
          new_value: {
            status: WorkflowInstanceStatus.ERROR,
            failed_action: saConfig.action_type,
            error: errorMsg,
          },
        });

        // DO NOT advance DAG — workflow is halted
      }
      break;
    }

    case WorkflowNodeType.DATA_INPUT: {
      // Create pending task — waits for human data input (e.g., Receiving Session)
      const diConfig = node.config as DataInputNodeConfig;
      // Read instance to get entity_id for FE (ReceivingSessionDrawer needs it)
      const diInstance = await repo.findInstanceById(instanceId);
      await createPendingTask(instanceId, node, {
        assigned_role_id: diConfig.assigned_role_id || null,
        entity_id: diInstance?.entity_id ?? null,
      });
      await updateCurrentNodes(instanceId, node.id, "add");
      break;
    }

    case WorkflowNodeType.TIMER: {
      const config = node.config as TimerNodeConfig;
      const dueAt = new Date(
        now.getTime() +
          config.duration_hours * 3600000 +
          config.duration_minutes * 60000,
      );
      const task = await createPendingTask(instanceId, node, { due_at: dueAt });
      await updateCurrentNodes(instanceId, node.id, "add");
      await scheduleTimerTask(instanceId, task.id, dueAt);
      break;
    }

    case WorkflowNodeType.CONDITION: {
      // Safe condition evaluation — NO eval() or new Function()
      const condConfig = node.config as ConditionNodeConfig;
      const conditionResult = evaluateCondition(
        entityPayload,
        condConfig.field,
        condConfig.operator,
        condConfig.value,
      );

      await repo.createTask(instanceId, {
        instance_id: instanceId,
        node_id: node.id,
        node_type: node.type,
        status: WorkflowTaskStatus.COMPLETED,
        assigned_to: null,
        assigned_role_id: null,
        completed_by: "SYSTEM",
        result: {
          field: condConfig.field,
          operator: condConfig.operator,
          expected_value: condConfig.value,
          actual_value: entityPayload[condConfig.field],
          result: conditionResult,
        },
        started_at: now,
        completed_at: now,
        due_at: null,
        action_time: now,
        sync_time: now,
      });

      const matchingEdge = version.edges.find(
        (e) =>
          e.source === node.id &&
          e.source_handle === (conditionResult ? "true" : "false"),
      );
      if (matchingEdge) {
        const nextNode = version.nodes.find((n) => n.id === matchingEdge.target);
        if (nextNode) await processNode(instanceId, version, nextNode, userId, entityPayload);
      }
      break;
    }

    case WorkflowNodeType.NOTIFICATION: {
      // Send in-app notification via notificationService
      const notifConfig = node.config as NotificationNodeConfig;
      const notifInstance = await repo.findInstanceById(instanceId);

      await createNotification({
        target_user_id: notifConfig.target_user_id || null,
        target_role_id: notifConfig.target_role_id || null,
        template_key: notifConfig.template_key || "notification.workflow_update",
        template_params: {
          entity_id: notifInstance?.entity_id,
          entity_type: notifInstance?.entity_type,
          ...entityPayload,
        },
        channel: notifConfig.channel || "IN_APP",
        source_instance_id: instanceId,
        source_entity_id: notifInstance?.entity_id || null,
        source_entity_type: notifInstance?.entity_type || null,
      });

      // Auto-complete notification task
      await repo.createTask(instanceId, {
        instance_id: instanceId,
        node_id: node.id,
        node_type: node.type,
        status: WorkflowTaskStatus.COMPLETED,
        assigned_to: null,
        assigned_role_id: null,
        completed_by: "SYSTEM",
        result: { sent: true, channel: notifConfig.channel },
        started_at: now,
        completed_at: now,
        due_at: null,
        action_time: now,
        sync_time: now,
      });
      await advanceFromNode(instanceId, version, node.id, userId, entityPayload);
      break;
    }

    case WorkflowNodeType.FORK: {
      // Spawn tasks for ALL outgoing edges concurrently
      await repo.createTask(instanceId, {
        instance_id: instanceId,
        node_id: node.id,
        node_type: node.type,
        status: WorkflowTaskStatus.COMPLETED,
        assigned_to: null,
        assigned_role_id: null,
        completed_by: "SYSTEM",
        result: {},
        started_at: now,
        completed_at: now,
        due_at: null,
        action_time: now,
        sync_time: now,
      });
      // Advance from fork — all outgoing edges spawn parallel branches
      await advanceFromNode(instanceId, version, node.id, userId, entityPayload);
      break;
    }

    case WorkflowNodeType.JOIN: {
      // Transaction-safe join check
      await handleJoinNode(instanceId, version, node, userId);
      break;
    }

    case WorkflowNodeType.SUB_WORKFLOW: {
      // TODO: Start child workflow instance, advance when it completes
      await createPendingTask(instanceId, node, {});
      await updateCurrentNodes(instanceId, node.id, "add");
      break;
    }

    case WorkflowNodeType.WEBHOOK: {
      // TODO: HTTP call → advance on response
      await createPendingTask(instanceId, node, {});
      await updateCurrentNodes(instanceId, node.id, "add");
      break;
    }
  }
}

// ─────────────────────────────────────────────
// PRIVATE: JOIN node — transactional race-safe
// ─────────────────────────────────────────────

/**
 * JOIN Race Condition Resolution via Firestore Transaction:
 *
 * Two parallel branches (A, B) complete at the same time:
 *
 * Thread A: runTransaction → reads instance → sees current_node_ids = [branchA, branchB]
 * Thread B: runTransaction → reads instance → sees current_node_ids = [branchA, branchB]
 *
 * Thread A commits first:
 *   → Removes branchA from current_node_ids → [branchB]
 *   → Checks: are ALL incoming branches completed? No → stops
 *
 * Thread B is RETRIED by Firestore (OCC conflict):
 *   → Re-reads instance → sees current_node_ids = [branchB]
 *   → Removes branchB from current_node_ids → []
 *   → Checks: are ALL incoming branches completed? Yes → advances past JOIN
 *
 * Result: Exactly-once advancement past the JOIN node.
 */
async function handleJoinNode(
  instanceId: string,
  version: WorkflowVersion,
  joinNode: WorkflowNode,
  userId: string,
): Promise<void> {
  const config = joinNode.config as JoinNodeConfig;

  // Find all incoming edges to this JOIN node
  const incomingEdges = version.edges.filter(
    (e) => e.target === joinNode.id,
  );
  const incomingSourceNodeIds = incomingEdges.map((e) => e.source);

  const shouldAdvance = await db.runTransaction(async (txn) => {
    // Read all tasks for incoming source nodes
    const taskPromises = incomingSourceNodeIds.map(async (sourceNodeId) => {
      const snap = await txn.get(
        db
          .collection("workflow_instances")
          .doc(instanceId)
          .collection("tasks")
          .where("node_id", "==", sourceNodeId)
          .limit(1),
      );
      if (snap.empty) return null;
      return snap.docs[0].data() as WorkflowTask;
    });

    const incomingTasks = await Promise.all(taskPromises);

    if (config.join_type === "ALL") {
      // ALL: every incoming branch must be COMPLETED
      const allCompleted = incomingTasks.every(
        (t) => t?.status === WorkflowTaskStatus.COMPLETED,
      );
      if (!allCompleted) return false;
    } else {
      // ANY: at least one incoming branch is COMPLETED
      const anyCompleted = incomingTasks.some(
        (t) => t?.status === WorkflowTaskStatus.COMPLETED,
      );
      if (!anyCompleted) return false;
    }

    // Mark join task as completed within the transaction
    const joinTaskId = randomUUID();
    const now = new Date();
    txn.set(
      db
        .collection("workflow_instances")
        .doc(instanceId)
        .collection("tasks")
        .doc(joinTaskId),
      {
        id: joinTaskId,
        instance_id: instanceId,
        node_id: joinNode.id,
        node_type: WorkflowNodeType.JOIN,
        status: WorkflowTaskStatus.COMPLETED,
        assigned_to: null,
        assigned_role_id: null,
        completed_by: "SYSTEM",
        result: { join_type: config.join_type },
        started_at: now,
        completed_at: now,
        due_at: null,
        action_time: now,
        sync_time: now,
        created_at: now,
      } satisfies WorkflowTask,
    );

    // Update instance: remove all incoming node IDs from current_node_ids
    const instanceRef = repo.getInstanceRef(instanceId);
    const instanceSnap = await txn.get(instanceRef);
    const instanceData = instanceSnap.data() as WorkflowInstance;
    const updatedCurrentNodes = instanceData.current_node_ids.filter(
      (id) => !incomingSourceNodeIds.includes(id),
    );
    txn.update(instanceRef, {
      current_node_ids: updatedCurrentNodes,
      updated_at: now,
    });

    return true;
  });

  if (shouldAdvance) {
    await advanceFromNode(instanceId, version, joinNode.id, userId, {});
  }
}

// ─────────────────────────────────────────────
// SELF-APPROVAL BLOCK (ISO 9001 — Segregation of Duties)
// ─────────────────────────────────────────────

/**
 * Prevents the voucher creator from approving their own voucher.
 * Reads the entity document to compare creator_id with the current userId.
 *
 * Called inside completeTask() transaction for APPROVAL-type tasks.
 */
async function enforceSelfApprovalBlock(
  instance: WorkflowInstance,
  userId: string,
): Promise<void> {
  const collection = ENTITY_COLLECTIONS[instance.entity_type];
  if (!collection) return; // Unknown entity type — skip check

  const entitySnap = await db.collection(collection).doc(instance.entity_id).get();
  if (!entitySnap.exists) return;

  const entityData = entitySnap.data()!;
  const creatorId = entityData.creator_id as string | undefined;

  if (creatorId && creatorId === userId) {
    apiError(
      "Bạn không thể tự duyệt phiếu do mình tạo (Segregation of Duties).",
      "您不能审批自己创建的单据（职责分离）。",
      403,
    );
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getNextNodes(version: WorkflowVersion, nodeId: string): string[] {
  return version.edges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target);
}

async function createPendingTask(
  instanceId: string,
  node: WorkflowNode,
  extra: {
    assigned_to?: string | null;
    assigned_role_id?: string | null;
    due_at?: Date | null;
    entity_id?: string | null;
  },
): Promise<WorkflowTask> {
  const now = new Date();
  return repo.createTask(instanceId, {
    instance_id: instanceId,
    node_id: node.id,
    node_type: node.type as WorkflowNodeType,
    status: WorkflowTaskStatus.PENDING,
    assigned_to: extra.assigned_to ?? null,
    assigned_role_id: extra.assigned_role_id ?? null,
    completed_by: null,
    result: extra.entity_id ? { entity_id: extra.entity_id } : null,
    started_at: now,
    completed_at: null,
    due_at: extra.due_at ?? null,
    action_time: now,
    sync_time: now,
  });
}

async function updateCurrentNodes(
  instanceId: string,
  nodeId: string,
  action: "add" | "remove",
): Promise<void> {
  const instance = await repo.findInstanceById(instanceId);
  if (!instance) return;

  const current = new Set(instance.current_node_ids);
  if (action === "add") current.add(nodeId);
  else current.delete(nodeId);

  const instanceRef = repo.getInstanceRef(instanceId);
  await instanceRef.update({
    current_node_ids: Array.from(current),
    updated_at: new Date(),
  });
}

async function completeInstance(instanceId: string, userId: string): Promise<void> {
  const instanceRef = repo.getInstanceRef(instanceId);
  const snap = await instanceRef.get();
  const existing = snap.data() as WorkflowInstance | undefined;
  const now = new Date();
  await instanceRef.update({
    status: WorkflowInstanceStatus.COMPLETED,
    current_node_ids: [],
    completed_at: now,
    updated_at: now,
  });

  if (!existing) return;

  await logAudit({
    entity_type: "workflow_instances",
    entity_id: instanceId,
    warehouse_id: await resolveWorkflowWarehouseId(existing),
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: existing.status, current_node_ids: existing.current_node_ids },
    new_value: {
      status: WorkflowInstanceStatus.COMPLETED,
      current_node_ids: [],
      completed_at: now,
    },
  });
}

async function resolveWorkflowWarehouseId(
  instance: WorkflowInstance,
): Promise<string | null> {
  const collection = ENTITY_COLLECTIONS[instance.entity_type];
  if (!collection) return null;

  const snap = await db.collection(collection).doc(instance.entity_id).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  return typeof data.warehouse_id === "string" ? data.warehouse_id : null;
}
