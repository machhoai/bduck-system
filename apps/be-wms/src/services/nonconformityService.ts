import {
  AuditAction,
  IssueType,
  NonconformityStatus,
  QuarantineStatus,
  ResolutionType,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type { Inventory, NonconformityReport } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  findQuarantinesByReportId,
  findReportById,
  findReports,
  quarantinesCollection,
  reportsCollection,
  type NonconformityFilters,
} from "../repositories/nonconformityRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface ResolveNonconformityInput {
  resolution_type: ResolutionType;
  resolution_notes: string | null;
  action_time?: string;
}

type ServiceError = Error & { statusCode: number; messages: Record<string, string> };

function createServiceError(statusCode: number, vi: string, zh: string): ServiceError {
  const error = new Error(vi) as ServiceError;
  error.statusCode = statusCode;
  error.messages = { vi, zh };
  return error;
}

function assertResolutionAllowed(
  report: NonconformityReport,
  resolutionType: ResolutionType,
) {
  const issueType = report.issue_type;

  if (issueType === IssueType.MISSING) {
    if (resolutionType === ResolutionType.ADJUST) return;
  } else if (issueType === IssueType.DISCREPANCY) {
    if (
      resolutionType === ResolutionType.REUSE ||
      resolutionType === ResolutionType.ADJUST
    ) {
      return;
    }
  } else if (
    issueType === IssueType.DAMAGED ||
    issueType === IssueType.EXPIRED ||
    issueType === IssueType.SEAL_BROKEN
  ) {
    if (
      resolutionType === ResolutionType.REUSE ||
      resolutionType === ResolutionType.RETURN ||
      resolutionType === ResolutionType.DESTROY
    ) {
      return;
    }
  }

  throw createServiceError(
    400,
    "Cach xu ly khong phu hop voi loai ngoai le.",
    "处理方式与异常类型不匹配。",
  );
}

function shouldReleaseToAtp(resolutionType: ResolutionType) {
  return resolutionType === ResolutionType.REUSE;
}

function toTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime();
    }
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === "number") {
      return timestamp._seconds * 1000;
    }
  }

  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function readActiveInventory(
  txn: FirebaseFirestore.Transaction,
  report: NonconformityReport,
) {
  const snapshot = await txn.get(
    db
      .collection("inventory")
      .where("warehouse_id", "==", report.warehouse_id)
      .where("warehouse_location_id", "==", report.warehouse_location_id)
      .where("product_id", "==", report.product_id)
      .limit(5),
  );

  const activeDocs = snapshot.docs.filter(
    (doc) => doc.data().is_deleted !== true,
  );
  if (activeDocs.length === 0) {
    throw createServiceError(
      400,
      "Khong tim thay ton kho lien quan den ngoai le nay.",
      "未找到与该异常相关的库存。",
    );
  }

  return activeDocs[0];
}

function buildInventoryUpdate(
  inventory: Inventory,
  report: NonconformityReport,
  hasQuarantine: boolean,
  resolutionType: ResolutionType,
) {
  const quantity = report.quantity_affected;
  let atp = inventory.atp_quantity;
  let onHold = inventory.on_hold_quantity;
  let quarantine = inventory.quarantine_quantity;

  if (hasQuarantine) {
    if (quarantine < quantity) {
      throw createServiceError(400, "So luong cach ly khong du.", "隔离数量不足。");
    }
    quarantine -= quantity;
  } else if (report.issue_type === IssueType.DISCREPANCY) {
    if (onHold < quantity) {
      throw createServiceError(400, "So luong tam giu khong du.", "暂扣数量不足。");
    }
    onHold -= quantity;
  } else {
    return null;
  }

  if (shouldReleaseToAtp(resolutionType)) {
    atp += quantity;
  }

  return {
    atp_quantity: atp,
    on_hold_quantity: onHold,
    quarantine_quantity: quarantine,
    total_quantity: calculateInventoryTotalQuantity({
      atp_quantity: atp,
      on_hold_quantity: onHold,
      in_transit_quantity: inventory.in_transit_quantity,
      quarantine_quantity: quarantine,
    }),
    last_updated_at: new Date(),
  };
}

export const fetchNonconformities = async (
  filters: NonconformityFilters,
): Promise<NonconformityReport[]> => {
  const reports = await findReports(filters);
  return reports.sort((a, b) => {
    return toTime(b.created_at) - toTime(a.created_at);
  });
};

export const fetchNonconformityDetail = async (id: string) => {
  const report = await findReportById(id);
  if (!report) {
    throw createServiceError(
      404,
      "Khong tim thay bao cao ngoai le.",
      "未找到异常报告。",
    );
  }

  const quarantine_records = await findQuarantinesByReportId(id);
  return { report, quarantine_records };
};

export const resolveNonconformity = async (
  id: string,
  input: ResolveNonconformityInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await findReportById(id);
  if (!existing) {
    throw createServiceError(
      404,
      "Khong tim thay bao cao ngoai le.",
      "未找到异常报告。",
    );
  }
  if (existing.status === NonconformityStatus.RESOLVED) {
    throw createServiceError(
      409,
      "Bao cao ngoai le da duoc xu ly.",
      "异常报告已处理。",
    );
  }
  if (existing.reporter_id === userId) {
    throw createServiceError(
      403,
      "Nguoi ghi nhan ngoai le khong duoc tu xu ly.",
      "异常记录人不得自行处理。",
    );
  }

  assertResolutionAllowed(existing, input.resolution_type);
  const actionTime = input.action_time
    ? new Date(input.action_time)
    : auditMetadata?.action_time;

  await db.runTransaction(async (txn) => {
    const reportRef = reportsCollection().doc(id);
    const reportSnap = await txn.get(reportRef);
    if (!reportSnap.exists) {
      throw createServiceError(
        404,
        "Khong tim thay bao cao ngoai le.",
        "未找到异常报告。",
      );
    }

    const report = reportSnap.data() as NonconformityReport;
    const quarantineSnap = await txn.get(
      quarantinesCollection()
        .where("nonconformity_report_id", "==", id)
        .where("is_deleted", "==", false),
    );
    const hasQuarantine = !quarantineSnap.empty;
    const inventoryDoc =
      hasQuarantine || report.issue_type === IssueType.DISCREPANCY
        ? await readActiveInventory(txn, report)
        : null;

    const now = new Date();
    const inventoryUpdate = inventoryDoc
      ? buildInventoryUpdate(
          inventoryDoc.data() as Inventory,
          report,
          hasQuarantine,
          input.resolution_type,
        )
      : null;

    if (inventoryDoc && inventoryUpdate) {
      txn.update(inventoryDoc.ref, inventoryUpdate);
    }

    quarantineSnap.docs.forEach((doc) => {
      txn.update(doc.ref, {
        status: shouldReleaseToAtp(input.resolution_type)
          ? QuarantineStatus.RELEASED
          : QuarantineStatus.DISPOSED,
        released_at: now,
        released_by: userId,
        release_notes: input.resolution_notes,
      });
    });

    txn.update(reportRef, {
      status: NonconformityStatus.RESOLVED,
      resolved_by: userId,
      resolution_type: input.resolution_type,
      resolution_notes: input.resolution_notes,
      updated_at: now,
    });
  });

  await logAudit({
    entity_type: "NONCONFORMITY_REPORT",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: {
      status: NonconformityStatus.RESOLVED,
      resolution_type: input.resolution_type,
      resolution_notes: input.resolution_notes,
    },
    ...auditMetadata,
    action_time: actionTime,
  });
};
