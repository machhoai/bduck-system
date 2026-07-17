import {
  AuditAction,
  ExpenseCategory,
  ExpenseStatus,
  type ExpenseDocument,
  type ExpenseItem,
} from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export const buildExpenseDocumentId = (
  warehouseId: string,
  period: string,
): string => `${warehouseId}_${period}`;

export const createDefaultExpenseItems = (): Record<string, ExpenseItem> =>
  Object.fromEntries(
    Object.values(ExpenseCategory).map((category) => [
      category,
      {
        actual_amount: 0,
        budget_amount: null,
        suggested_amount: null,
        attachments: [],
        note: null,
      },
    ]),
  );

export const createDefaultExpenseDocument = (
  warehouseId: string,
  period: string,
  userId: string,
): ExpenseDocument => {
  const now = new Date();
  return {
    id: buildExpenseDocumentId(warehouseId, period),
    warehouse_id: warehouseId,
    period,
    status: ExpenseStatus.OPEN,
    items: createDefaultExpenseItems() as Record<ExpenseCategory, ExpenseItem>,
    custom_items: {},
    created_by: userId,
    updated_by: userId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
};

export const getWritableExpenseDocument = async (
  warehouseId: string,
  period: string,
  userId: string,
): Promise<ExpenseDocument> => {
  const document =
    (await expenseRepo.getById(buildExpenseDocumentId(warehouseId, period))) ??
    createDefaultExpenseDocument(warehouseId, period, userId);
  if (document.status === ExpenseStatus.CLOSED) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đã chốt. Không thể cập nhật chi phí.",
        zh: "会计期间已结账，无法更新费用。",
      },
    };
  }
  return document;
};

export const writeExpenseAudit = async (params: {
  action: AuditAction;
  warehouseId: string;
  period: string;
  userId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes: string;
  auditMetadata?: AuditMetadata;
}): Promise<void> => {
  await logAudit({
    entity_type: "expenses",
    entity_id: buildExpenseDocumentId(params.warehouseId, params.period),
    warehouse_id: params.warehouseId,
    action: params.action,
    user_id: params.userId,
    old_value: params.oldValue,
    new_value: params.newValue,
    notes: params.notes,
    ...params.auditMetadata,
  });
};
