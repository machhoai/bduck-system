import {
  LEAVE_IMPORT_TEMPLATE_VERSION,
  LeaveImportBatchStatus,
  LeaveImportRecordType,
  type CommitLeaveImportInput,
  type LeaveImportBatch,
  type LeaveImportBatchView,
  type LeaveImportCommitResult,
  type LocalizedText,
} from "@bduck/shared-types";
import { commitLeaveImportRow } from "../repositories/leaveImportCommitRepository.js";
import {
  findLeaveImportBatch,
  findLeaveImportBatches,
  findLeaveImportRows,
  markLeaveImportCommitted,
  markLeaveImportCommitting,
  markLeaveImportFailed,
} from "../repositories/leaveImportRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanImportLeaveHistory,
  assertLeaveImportBatchAccess,
  buildLeaveImportRowViews,
  canImportLeaveForProfile,
  canImportLeaveRecord,
  mapEmployeeProfilesByCode,
} from "./leaveImportAccessService.js";
import {
  auditLeaveImportBatchUpdate,
  auditLeaveImportRowCommit,
} from "./leaveImportAuditService.js";

const localized = (vi: string, zh: string): LocalizedText => ({ vi, zh });

export const fetchLeaveImportBatchView = async (
  batchId: string,
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveImportBatchView> => {
  const batch = await findLeaveImportBatch(batchId);
  if (!batch) throw { statusCode: 404 };
  assertLeaveImportBatchAccess(batch, actorId, authorization);
  const [rows, profiles] = await Promise.all([
    findLeaveImportRows(batchId),
    findEmployeeProfiles(),
  ]);
  return {
    batch,
    rows: buildLeaveImportRowViews(rows, mapEmployeeProfilesByCode(profiles)),
  };
};

export const fetchLeaveImportBatches = async (
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveImportBatch[]> => {
  assertCanImportLeaveHistory(authorization);
  return (await findLeaveImportBatches()).filter((batch) => {
    try {
      assertLeaveImportBatchAccess(batch, actorId, authorization);
      return true;
    } catch {
      return false;
    }
  });
};

export const commitLeaveHistoryImport = async (
  batchId: string,
  input: CommitLeaveImportInput,
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveImportCommitResult> => {
  const view = await fetchLeaveImportBatchView(
    batchId,
    actorId,
    authorization,
  );
  if (view.batch.status === LeaveImportBatchStatus.COMMITTED) {
    return {
      batch: view.batch,
      committed_rows: view.batch.committed_rows,
      duplicate_rows: view.batch.total_rows,
    };
  }
  if (view.batch.invalid_rows > 0 || view.rows.some((row) => !row.is_valid)) {
    throw {
      statusCode: 409,
      messages: localized(
        "Không thể ghi nhận khi tệp còn dòng không hợp lệ.",
        "文件仍有无效行，无法提交。",
      ),
    };
  }

  const profiles = mapEmployeeProfilesByCode(await findEmployeeProfiles());
  const committing = await markLeaveImportCommitting(
    batchId,
    input.action_time,
  );
  await auditLeaveImportBatchUpdate({
    previous: view.batch,
    batch: committing,
    actor_id: actorId,
    action_time: input.action_time,
  });
  let committedRows = view.rows.filter((row) => row.committed_at).length;
  let duplicateRows = 0;
  try {
    for (const row of view.rows) {
      const profile = profiles.get(row.employee_code.toUpperCase());
      if (!profile || !canImportLeaveForProfile(authorization, profile)) {
        throw new Error("LEAVE_IMPORT_PROFILE_UNAVAILABLE");
      }
      if (
        !canImportLeaveRecord(
          authorization,
          profile,
          row.record_type as LeaveImportRecordType,
        )
      ) {
        throw new Error("LEAVE_IMPORT_ADJUSTMENT_PERMISSION_DENIED");
      }
      const result = await commitLeaveImportRow({
        row_id: row.id,
        profile,
        actor_id: actorId,
        action_time: input.action_time,
      });
      if (result.duplicate) duplicateRows += 1;
      if (!row.committed_at) committedRows += 1;
      await auditLeaveImportRowCommit({
        result,
        actor_id: actorId,
        action_time: input.action_time,
      });
    }
    const batch = await markLeaveImportCommitted(
      batchId,
      committedRows,
      input.action_time,
    );
    await auditLeaveImportBatchUpdate({
      previous: committing,
      batch,
      actor_id: actorId,
      action_time: input.action_time,
    });
    return {
      batch,
      committed_rows: committedRows,
      duplicate_rows: duplicateRows,
    };
  } catch (error) {
    const failure = localized(
      "Ghi nhận bị gián đoạn. Có thể thử lại an toàn mà không tạo dữ liệu trùng.",
      "提交被中断，可安全重试且不会产生重复数据。",
    );
    const failed = await markLeaveImportFailed(
      batchId,
      committedRows,
      failure,
      input.action_time,
    );
    await auditLeaveImportBatchUpdate({
      previous: committing,
      batch: failed,
      actor_id: actorId,
      action_time: input.action_time,
    });
    console.error("[leaveImportService] commit error:", error);
    throw { statusCode: 409, messages: failure };
  }
};

export { LEAVE_IMPORT_TEMPLATE_VERSION };
