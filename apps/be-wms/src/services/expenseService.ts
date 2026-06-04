/**
 * Expense Service — Core Business Logic
 *
 * ═══════════════════════════════════════════════════════════════
 * RULES:
 * 1. Lazy Init: GET never returns 404. Missing docs are
 *    auto-created with OPEN status and zero values.
 * 2. Immutable CLOSED: No writes allowed after period is closed.
 * 3. Consolidated View: warehouseId === 'ALL' triggers
 *    cross-warehouse aggregation (read-only).
 * 4. Real-time suggestions: calculateAutoExpenses() is called
 *    on every single-warehouse GET to refresh suggested_amount.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  ExpenseCategory,
  ExpenseStatus,
  type ExpenseDocument,
  type ExpenseItem,
} from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";
import { calculateAutoExpenses } from "./expenseCalculationService.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildDocId(warehouseId: string, period: string): string {
  return `${warehouseId}_${period}`;
}

function createDefaultItems(): Record<string, ExpenseItem> {
  const items: Record<string, ExpenseItem> = {};
  for (const cat of Object.values(ExpenseCategory)) {
    items[cat] = {
      actual_amount: 0,
      budget_amount: null,
      suggested_amount: null,
      attachments: [],
      note: null,
    };
  }
  return items;
}

function createDefaultDocument(
  warehouseId: string,
  period: string,
  userId: string,
): ExpenseDocument {
  const now = new Date();
  return {
    id: buildDocId(warehouseId, period),
    warehouse_id: warehouseId,
    period,
    status: ExpenseStatus.OPEN,
    items: createDefaultItems() as Record<ExpenseCategory, ExpenseItem>,
    custom_items: {},
    created_by: userId,
    updated_by: userId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

// ─────────────────────────────────────────────
// GET — Single Warehouse (Lazy Init + Auto Suggest)
// ─────────────────────────────────────────────

async function getForSingleWarehouse(
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  let doc = await expenseRepo.getById(docId);

  // Rule 1: Lazy Initialization
  if (!doc) {
    doc = createDefaultDocument(warehouseId, period, userId);
    await expenseRepo.upsert(docId, doc);
  }

  // Rule 4: Always refresh suggested_amount from WMS
  const auto = await calculateAutoExpenses(warehouseId, period);
  if (doc.items[ExpenseCategory.COGS]) {
    doc.items[ExpenseCategory.COGS].suggested_amount = auto.cogs;
  }
  if (doc.items[ExpenseCategory.GIFT_EXPENSE]) {
    doc.items[ExpenseCategory.GIFT_EXPENSE].suggested_amount = auto.gift;
  }

  // Persist the updated suggestions (non-blocking fire-and-forget)
  expenseRepo.upsert(docId, doc).catch((err) =>
    console.error("[expenseService] Failed to persist suggestions:", err),
  );

  return doc;
}

// ─────────────────────────────────────────────
// GET — Consolidated View (ALL warehouses)
// ─────────────────────────────────────────────

async function getConsolidatedView(
  period: string,
): Promise<ExpenseDocument> {
  const docs = await expenseRepo.findByPeriod(period);

  // Build a virtual aggregated document
  const aggregated = createDefaultDocument("ALL", period, "system");
  aggregated.status = ExpenseStatus.OPEN; // Keep OPEN — FE uses warehouseId==='ALL' for read-only logic

  for (const doc of docs) {
    for (const cat of Object.values(ExpenseCategory)) {
      const source = doc.items[cat];
      const target = aggregated.items[cat as ExpenseCategory];
      if (source && target) {
        target.actual_amount += source.actual_amount;
        target.budget_amount =
          (target.budget_amount || 0) + (source.budget_amount || 0);
        target.suggested_amount =
          (target.suggested_amount || 0) + (source.suggested_amount || 0);
      }
    }
  }

  return aggregated;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export async function getExpenseData(
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> {
  if (warehouseId === "ALL") {
    return getConsolidatedView(period);
  }
  return getForSingleWarehouse(warehouseId, period, userId);
}

export async function updateExpenseItem(
  warehouseId: string,
  period: string,
  category: ExpenseCategory,
  itemData: Partial<ExpenseItem>,
  userId: string,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  let doc = await expenseRepo.getById(docId);

  // Lazy init if doesn't exist
  if (!doc) {
    doc = createDefaultDocument(warehouseId, period, userId);
  }

  // Rule 2: Immutable CLOSED state
  if (doc.status === ExpenseStatus.CLOSED) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đã chốt. Không thể cập nhật chi phí.",
        zh: "会计期间已结账，无法更新费用。",
      },
    };
  }

  // Merge item data
  const existing = doc.items[category] || createDefaultItems()[category];
  doc.items[category] = {
    ...existing,
    ...itemData,
    // Preserve suggested_amount — only WMS integration can set it
    suggested_amount: existing.suggested_amount,
  };
  doc.updated_by = userId;
  doc.updated_at = new Date();

  await expenseRepo.upsert(docId, doc);
  return doc;
}

export async function closePeriod(
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  let doc = await expenseRepo.getById(docId);

  if (!doc) {
    doc = createDefaultDocument(warehouseId, period, userId);
  }

  if (doc.status === ExpenseStatus.CLOSED) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đã được chốt trước đó.",
        zh: "会计期间已经结账。",
      },
    };
  }

  doc.status = ExpenseStatus.CLOSED;
  doc.updated_by = userId;
  doc.updated_at = new Date();

  await expenseRepo.upsert(docId, doc);
  return doc;
}

export async function reopenPeriod(
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  const doc = await expenseRepo.getById(docId);

  if (!doc) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy kỳ kế toán.",
        zh: "未找到会计期间。",
      },
    };
  }

  if (doc.status === ExpenseStatus.OPEN) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đang mở, không cần mở lại.",
        zh: "会计期间已开放，无需重新打开。",
      },
    };
  }

  doc.status = ExpenseStatus.OPEN;
  doc.updated_by = userId;
  doc.updated_at = new Date();

  await expenseRepo.upsert(docId, doc);
  return doc;
}
