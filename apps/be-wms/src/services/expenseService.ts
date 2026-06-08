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
  AuditAction,
  ExpenseCategory,
  ExpenseCostCenter,
  ExpenseStatus,
  type ExpenseCustomItem,
  type ExpenseDocument,
  type ExpenseItem,
} from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
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

function closedPeriodError() {
  return {
    statusCode: 400,
    messages: {
      vi: "Kỳ kế toán đã chốt. Không thể cập nhật chi phí.",
      zh: "会计期间已结账，无法更新费用。",
    },
  };
}

async function getWritableExpenseDocument(
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  const doc =
    (await expenseRepo.getById(docId)) ??
    createDefaultDocument(warehouseId, period, userId);

  if (doc.status === ExpenseStatus.CLOSED) {
    throw closedPeriodError();
  }

  return doc;
}

async function writeExpenseAudit(params: {
  action: AuditAction;
  warehouseId: string;
  period: string;
  userId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes: string;
  auditMetadata?: AuditMetadata;
}) {
  await logAudit({
    entity_type: "expenses",
    entity_id: buildDocId(params.warehouseId, params.period),
    warehouse_id: params.warehouseId,
    action: params.action,
    user_id: params.userId,
    old_value: params.oldValue,
    new_value: params.newValue,
    notes: params.notes,
    ...params.auditMetadata,
  });
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
  // Wrapped in try-catch: missing Firestore index or query error should NOT
  // crash the entire expense page. Suggestions degrade gracefully to null.
  try {
    const auto = await calculateAutoExpenses(warehouseId, period);
    if (doc.items[ExpenseCategory.COGS]) {
      doc.items[ExpenseCategory.COGS].suggested_amount = auto.cogs;
    }
    if (doc.items[ExpenseCategory.GIFT_EXPENSE]) {
      doc.items[ExpenseCategory.GIFT_EXPENSE].suggested_amount = auto.gift;
    }
  } catch (autoErr) {
    console.error(
      "[expenseService] calculateAutoExpenses failed (non-fatal):",
      autoErr,
    );
    // Continue — suggested_amount stays as previously stored or null
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
  auditMetadata?: AuditMetadata,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  const doc = await getWritableExpenseDocument(warehouseId, period, userId);

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
  await writeExpenseAudit({
    action: AuditAction.UPDATE,
    warehouseId,
    period,
    userId,
    oldValue: { category, item: existing },
    newValue: { category, item: doc.items[category] },
    notes: `Update standard expense item ${category}`,
    auditMetadata,
  });
  return doc;
}

export async function getExpenseCustomItem(
  warehouseId: string,
  period: string,
  itemId: string,
): Promise<ExpenseCustomItem | null> {
  const doc = await expenseRepo.getById(buildDocId(warehouseId, period));
  const item = doc?.custom_items?.[itemId];
  if (!item || item.is_deleted) return null;
  return item;
}

export async function saveCustomExpenseItem(
  warehouseId: string,
  period: string,
  itemId: string,
  itemData: {
    label: string;
    cost_center: ExpenseCostCenter;
    actual_amount: number;
    budget_amount: number | null;
    note?: string | null;
  },
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  const doc = await getWritableExpenseDocument(warehouseId, period, userId);
  const existing = doc.custom_items?.[itemId] ?? null;
  const customItem: ExpenseCustomItem = {
    id: itemId,
    label: itemData.label,
    cost_center: itemData.cost_center,
    actual_amount: itemData.actual_amount,
    budget_amount: itemData.budget_amount,
    suggested_amount: existing?.suggested_amount ?? null,
    attachments: existing?.attachments ?? [],
    note: itemData.note ?? existing?.note ?? null,
    is_deleted: false,
  };

  doc.custom_items = {
    ...(doc.custom_items ?? {}),
    [itemId]: customItem,
  };
  doc.updated_by = userId;
  doc.updated_at = new Date();

  await expenseRepo.upsert(docId, doc);
  await writeExpenseAudit({
    action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
    warehouseId,
    period,
    userId,
    oldValue: existing ? { custom_item_id: itemId, item: existing } : null,
    newValue: { custom_item_id: itemId, item: customItem },
    notes: existing
      ? `Update custom expense item ${itemId}`
      : `Create custom expense item ${itemId}`,
    auditMetadata,
  });

  return doc;
}

export async function deleteCustomExpenseItem(
  warehouseId: string,
  period: string,
  itemId: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<ExpenseDocument> {
  const docId = buildDocId(warehouseId, period);
  const doc = await getWritableExpenseDocument(warehouseId, period, userId);
  const existing = doc.custom_items?.[itemId];

  if (!existing || existing.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy mục chi phí tùy chỉnh.",
        zh: "未找到自定义费用项。",
      },
    };
  }

  const deletedItem = { ...existing, is_deleted: true };
  doc.custom_items = {
    ...(doc.custom_items ?? {}),
    [itemId]: deletedItem,
  };
  doc.updated_by = userId;
  doc.updated_at = new Date();

  await expenseRepo.upsert(docId, doc);
  await writeExpenseAudit({
    action: AuditAction.SOFT_DELETE,
    warehouseId,
    period,
    userId,
    oldValue: { custom_item_id: itemId, item: existing },
    newValue: { custom_item_id: itemId, item: deletedItem },
    notes: `Soft delete custom expense item ${itemId}`,
    auditMetadata,
  });

  return doc;
}

export async function closePeriod(
  warehouseId: string,
  period: string,
  userId: string,
  auditMetadata?: AuditMetadata,
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
  await writeExpenseAudit({
    action: AuditAction.UPDATE,
    warehouseId,
    period,
    userId,
    oldValue: { status: ExpenseStatus.OPEN },
    newValue: { status: ExpenseStatus.CLOSED },
    notes: "Close expense accounting period",
    auditMetadata,
  });
  return doc;
}

export async function reopenPeriod(
  warehouseId: string,
  period: string,
  userId: string,
  auditMetadata?: AuditMetadata,
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
  await writeExpenseAudit({
    action: AuditAction.UPDATE,
    warehouseId,
    period,
    userId,
    oldValue: { status: ExpenseStatus.CLOSED },
    newValue: { status: ExpenseStatus.OPEN },
    notes: "Reopen expense accounting period",
    auditMetadata,
  });
  return doc;
}
