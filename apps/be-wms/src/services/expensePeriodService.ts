import {
  AuditAction,
  ExpenseStatus,
  type ExpenseDocument,
} from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";
import type { AuditMetadata } from "./auditService.js";
import {
  buildExpenseDocumentId,
  createDefaultExpenseDocument,
  writeExpenseAudit,
} from "./expenseServiceSupport.js";

export const closePeriod = async (
  warehouseId: string,
  period: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<ExpenseDocument> => {
  const documentId = buildExpenseDocumentId(warehouseId, period);
  const document =
    (await expenseRepo.getById(documentId)) ??
    createDefaultExpenseDocument(warehouseId, period, userId);
  if (document.status === ExpenseStatus.CLOSED) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đã được chốt trước đó.",
        zh: "会计期间已经结账。",
      },
    };
  }
  document.status = ExpenseStatus.CLOSED;
  document.updated_by = userId;
  document.updated_at = new Date();
  await expenseRepo.upsert(documentId, document);
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
  return document;
};

export const reopenPeriod = async (
  warehouseId: string,
  period: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<ExpenseDocument> => {
  const documentId = buildExpenseDocumentId(warehouseId, period);
  const document = await expenseRepo.getById(documentId);
  if (!document) {
    throw {
      statusCode: 404,
      messages: { vi: "Không tìm thấy kỳ kế toán.", zh: "未找到会计期间。" },
    };
  }
  if (document.status === ExpenseStatus.OPEN) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Kỳ kế toán đang mở, không cần mở lại.",
        zh: "会计期间已开放，无需重新打开。",
      },
    };
  }
  document.status = ExpenseStatus.OPEN;
  document.updated_by = userId;
  document.updated_at = new Date();
  await expenseRepo.upsert(documentId, document);
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
  return document;
};
