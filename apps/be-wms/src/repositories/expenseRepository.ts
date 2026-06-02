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
): Promise<ExpenseDocument[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("period", "==", period)
    .get();
  return snap.docs.map((d) => d.data() as ExpenseDocument);
}

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

export async function upsert(
  id: string,
  data: ExpenseDocument,
): Promise<void> {
  await db.collection(COLLECTION).doc(id).set(data, { merge: true });
}
