import type {
  ApprovalRecord,
  ProcessEntityType,
} from "@bduck/shared-types";

const RESTARTABLE_ENTITY_TYPES = new Set<ProcessEntityType>([
  "IMPORT_VOUCHER",
  "EXPORT_VOUCHER",
  "TRANSFER_ORDER",
  "TRANSFER_INTRA",
]);

const RESTARTABLE_ENTITY_STATUSES = new Set([
  "PENDING_APPROVAL",
  "REJECTED",
  "CANCELLED",
]);

const restartError = (statusCode: number, vi: string, zh: string) => ({
  statusCode,
  messages: { vi, zh },
});

export interface CurrentApprovalAttempt {
  attempt: number;
  records: ApprovalRecord[];
}

export function getCurrentApprovalAttempt(
  records: readonly ApprovalRecord[],
): CurrentApprovalAttempt {
  if (records.length === 0) {
    throw restartError(
      404,
      "Không tìm thấy luồng duyệt để khởi tạo lại.",
      "未找到可重新初始化的审批流程。",
    );
  }

  const attempt = records.reduce(
    (max, record) => Math.max(max, record.approval_attempt ?? 1),
    1,
  );
  return {
    attempt,
    records: records.filter(
      (record) => (record.approval_attempt ?? 1) === attempt,
    ),
  };
}

export function assertApprovalRestartable(
  entityType: ProcessEntityType,
  entityStatus: string,
  currentAttempt: CurrentApprovalAttempt,
): void {
  if (!RESTARTABLE_ENTITY_TYPES.has(entityType)) {
    throw restartError(
      400,
      "Loại chứng từ này chưa hỗ trợ khởi tạo lại luồng duyệt.",
      "此单据类型暂不支持重新初始化审批流程。",
    );
  }

  if (!RESTARTABLE_ENTITY_STATUSES.has(entityStatus)) {
    throw restartError(
      409,
      `Không thể khởi tạo lại luồng duyệt khi chứng từ đang ở trạng thái ${entityStatus}.`,
      `单据处于 ${entityStatus} 状态时无法重新初始化审批流程。`,
    );
  }

  if (currentAttempt.records.some((record) => record.status === "APPROVED")) {
    throw restartError(
      409,
      "Không thể khởi tạo lại vì đã có ít nhất một cấp được duyệt trong lần duyệt hiện tại.",
      "当前审批轮次已有至少一个层级通过，无法重新初始化。",
    );
  }
}
