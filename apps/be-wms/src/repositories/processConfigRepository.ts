/**
 * Process Config Repository — Firestore CRUD
 *
 * Collection: process_configs
 *
 * LOOKUP PRIORITY:
 *   1. (entity_type + warehouse_id) — warehouse-specific config
 *   2. (entity_type + warehouse_id=null) — global default
 *   3. Hardcoded fallback → returned by service layer
 */

import { db } from "../config/firebase.js";
import type { ProcessConfig, ProcessEntityType, ApprovalLevel } from "@bduck/shared-types";

const COLLECTION = "process_configs";

/**
 * Find config for an entity type, optionally scoped to a warehouse.
 * Falls back to global config (warehouse_id=null) if no scoped config found.
 */
export async function findByEntityType(
  entityType: ProcessEntityType,
  warehouseId?: string | null,
): Promise<ProcessConfig | null> {
  // Try warehouse-scoped config first
  if (warehouseId) {
    const scopedSnap = await db
      .collection(COLLECTION)
      .where("entity_type", "==", entityType)
      .where("warehouse_id", "==", warehouseId)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (!scopedSnap.empty) {
      const doc = scopedSnap.docs[0];
      return { id: doc.id, ...doc.data() } as ProcessConfig;
    }
  }

  // Fallback to global config (warehouse_id = null)
  const globalSnap = await db
    .collection(COLLECTION)
    .where("entity_type", "==", entityType)
    .where("warehouse_id", "==", null)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (!globalSnap.empty) {
    const doc = globalSnap.docs[0];
    return { id: doc.id, ...doc.data() } as ProcessConfig;
  }

  return null;
}

/**
 * Get the ACTIVE approval chain for an entity type.
 * Filters out disabled optional levels.
 * Returns levels sorted by level number ascending.
 */
export async function getActiveApprovalChain(
  entityType: ProcessEntityType,
  warehouseId?: string | null,
): Promise<ApprovalLevel[]> {
  const config = await findByEntityType(entityType, warehouseId);
  if (!config) return [];

  return config.approval_chain
    .filter((lvl) => lvl.required || lvl.enabled)
    .sort((a, b) => a.level - b.level);
}

/** List all configs (admin view) */
export async function findAll(): Promise<ProcessConfig[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("is_deleted", "==", false)
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as ProcessConfig,
  );
}

/** Get a single config by ID */
export async function findById(id: string): Promise<ProcessConfig | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ProcessConfig;
}

/** Create a new config */
export async function create(
  data: Omit<ProcessConfig, "id">,
): Promise<ProcessConfig> {
  const ref = db.collection(COLLECTION).doc();
  const doc = { ...data, id: ref.id };
  await ref.set(doc);
  return doc as ProcessConfig;
}

/** Update an existing config */
export async function update(
  id: string,
  data: Partial<Pick<ProcessConfig, "approval_chain" | "auto_approve" | "step_options" | "updated_at">>,
): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}
