/**
 * Expense Repository — Firestore CRUD
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - Repository layer: ONLY handles Firestore read/write.
 * - NO business logic, no validation, no audit logging.
 * - Business logic belongs in expenseService.ts.
 * - Document ID format: {warehouse_id}_{YYYY-MM}
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import type { ExpenseDocument } from "@bduck/shared-types";

const COLLECTION = "expenses";

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function getById(id: string): Promise<ExpenseDocument | null> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as ExpenseDocument;
}

export async function findByPeriod(
  period: string,
  warehouseIds?: readonly string[],
): Promise<ExpenseDocument[]> {
  if (warehouseIds?.length === 0) return [];
  if (!warehouseIds) {
    const snap = await db
      .collection(COLLECTION)
      .where("period", "==", period)
      .get();
    return snap.docs.map((document) => document.data() as ExpenseDocument);
  }

  const uniqueIds = Array.from(new Set(warehouseIds));
  const documents = new Map<string, ExpenseDocument>();
  for (let index = 0; index < uniqueIds.length; index += 10) {
    const snapshot = await db
      .collection(COLLECTION)
      .where("period", "==", period)
      .where("warehouse_id", "in", uniqueIds.slice(index, index + 10))
      .get();
    snapshot.docs.forEach((document) =>
      documents.set(document.id, document.data() as ExpenseDocument),
    );
  }
  return Array.from(documents.values());
}

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

export async function upsert(id: string, data: ExpenseDocument): Promise<void> {
  await db.collection(COLLECTION).doc(id).set(data, { merge: true });
}
