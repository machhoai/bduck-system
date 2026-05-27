/**
 * Workflow Repository — Firestore CRUD for workflow collections.
 *
 * Collections:
 *   workflow_definitions              → Top-level blueprints
 *   workflow_definitions/{id}/versions → Immutable DAG versions
 *   workflow_instances                → Runtime voucher processes
 *   workflow_instances/{id}/tasks     → Per-node execution tasks
 *
 * RULE: No hard deletes (ISO 9001). Only soft delete via is_deleted flag.
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import type {
  WorkflowDefinition,
  WorkflowVersion,
  WorkflowInstance,
  WorkflowTask,
} from "@bduck/shared-types";

const DEFINITIONS_COL = "workflow_definitions";
const INSTANCES_COL = "workflow_instances";

// ─────────────────────────────────────────────
// DEFINITIONS
// ─────────────────────────────────────────────

export const findDefinitionById = async (
  id: string,
): Promise<WorkflowDefinition | null> => {
  const doc = await db.collection(DEFINITIONS_COL).doc(id).get();
  return doc.exists ? (doc.data() as WorkflowDefinition) : null;
};

export const findDefinitions = async (
  includeDeleted = false,
): Promise<WorkflowDefinition[]> => {
  let query: FirebaseFirestore.Query = db.collection(DEFINITIONS_COL);
  if (!includeDeleted) {
    query = query.where("is_deleted", "==", false);
  }
  const snap = await query.orderBy("created_at", "desc").get();
  return snap.docs.map((d) => d.data() as WorkflowDefinition);
};

export const findActiveDefinitionForEntity = async (
  entityType: string,
  warehouseId: string | null,
): Promise<WorkflowDefinition | null> => {
  let query = db
    .collection(DEFINITIONS_COL)
    .where("is_deleted", "==", false)
    .where("status", "==", "ACTIVE")
    .where("entity_type", "==", entityType);

  const snap = await query.get();
  const definitions = snap.docs.map((d) => d.data() as WorkflowDefinition);

  // Priority: warehouse-specific > global (null scope)
  const warehouseScoped = warehouseId
    ? definitions.find(
        (d) =>
          d.scope_warehouse_ids?.includes(warehouseId),
      )
    : null;

  return warehouseScoped || definitions.find((d) => !d.scope_warehouse_ids) || null;
};

export const createDefinition = async (
  data: Omit<WorkflowDefinition, "id" | "is_deleted" | "created_at" | "updated_at">,
): Promise<WorkflowDefinition> => {
  const id = randomUUID();
  const now = new Date();
  const doc: WorkflowDefinition = {
    ...data,
    id,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  await db.collection(DEFINITIONS_COL).doc(id).set(doc);
  return doc;
};

export const updateDefinition = async (
  id: string,
  data: Partial<Pick<WorkflowDefinition, "name" | "description" | "entity_type" | "scope_warehouse_ids" | "status" | "current_version_id">>,
): Promise<void> => {
  await db
    .collection(DEFINITIONS_COL)
    .doc(id)
    .update({ ...data, updated_at: new Date() });
};

export const softDeleteDefinition = async (id: string): Promise<void> => {
  await db.collection(DEFINITIONS_COL).doc(id).update({
    is_deleted: true,
    status: "ARCHIVED",
    updated_at: new Date(),
  });
};

// ─────────────────────────────────────────────
// VERSIONS (subcollection)
// ─────────────────────────────────────────────

const versionsCol = (definitionId: string) =>
  db.collection(DEFINITIONS_COL).doc(definitionId).collection("versions");

export const findVersionById = async (
  definitionId: string,
  versionId: string,
): Promise<WorkflowVersion | null> => {
  const doc = await versionsCol(definitionId).doc(versionId).get();
  return doc.exists ? (doc.data() as WorkflowVersion) : null;
};

export const findVersionsByDefinition = async (
  definitionId: string,
): Promise<WorkflowVersion[]> => {
  const snap = await versionsCol(definitionId)
    .orderBy("version_number", "desc")
    .get();
  return snap.docs.map((d) => d.data() as WorkflowVersion);
};

export const getNextVersionNumber = async (
  definitionId: string,
): Promise<number> => {
  const snap = await versionsCol(definitionId)
    .orderBy("version_number", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 1;
  return (snap.docs[0].data() as WorkflowVersion).version_number + 1;
};

export const createVersion = async (
  definitionId: string,
  data: Omit<WorkflowVersion, "id" | "created_at">,
): Promise<WorkflowVersion> => {
  const id = randomUUID();
  const now = new Date();
  const doc: WorkflowVersion = { ...data, id, created_at: now };
  await versionsCol(definitionId).doc(id).set(doc);
  return doc;
};

// ─────────────────────────────────────────────
// INSTANCES (runtime)
// ─────────────────────────────────────────────

export const findInstanceById = async (
  id: string,
): Promise<WorkflowInstance | null> => {
  const doc = await db.collection(INSTANCES_COL).doc(id).get();
  return doc.exists ? (doc.data() as WorkflowInstance) : null;
};

export const createInstance = async (
  data: Omit<WorkflowInstance, "id" | "is_deleted" | "created_at" | "updated_at">,
): Promise<WorkflowInstance> => {
  const id = randomUUID();
  const now = new Date();
  const doc: WorkflowInstance = {
    ...data,
    id,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  await db.collection(INSTANCES_COL).doc(id).set(doc);
  return doc;
};

/**
 * Get Firestore reference for use inside runTransaction().
 */
export const getInstanceRef = (id: string) =>
  db.collection(INSTANCES_COL).doc(id);

// ─────────────────────────────────────────────
// TASKS (subcollection of instances)
// ─────────────────────────────────────────────

const tasksCol = (instanceId: string) =>
  db.collection(INSTANCES_COL).doc(instanceId).collection("tasks");

export const createTask = async (
  instanceId: string,
  data: Omit<WorkflowTask, "id" | "created_at">,
): Promise<WorkflowTask> => {
  const id = randomUUID();
  const now = new Date();
  const doc: WorkflowTask = { ...data, id, created_at: now };
  await tasksCol(instanceId).doc(id).set(doc);
  return doc;
};

export const findTasksByInstance = async (
  instanceId: string,
): Promise<WorkflowTask[]> => {
  const snap = await tasksCol(instanceId).get();
  return snap.docs.map((d) => d.data() as WorkflowTask);
};

export const findTasksByNodeId = async (
  instanceId: string,
  nodeId: string,
): Promise<WorkflowTask[]> => {
  const snap = await tasksCol(instanceId)
    .where("node_id", "==", nodeId)
    .get();
  return snap.docs.map((d) => d.data() as WorkflowTask);
};

export const getTaskRef = (instanceId: string, taskId: string) =>
  tasksCol(instanceId).doc(taskId);

/** Get the Firestore instance for transaction usage */
export const getDb = () => db;
