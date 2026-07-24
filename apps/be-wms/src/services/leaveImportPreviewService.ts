import {
  LeaveImportRecordType,
  type EmployeeProfile,
  type LeaveBalanceBucket,
  type LeaveImportBatchView,
  type LocalizedText,
  type PreviewLeaveImportInput,
} from "@bduck/shared-types";
import { createLeaveImportPreview } from "../repositories/leaveImportRepository.js";
import {
  createEmptyLeaveBalanceBucket,
  findLeaveBalanceBuckets,
} from "../repositories/leaveBalanceRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { applyLeaveDelta } from "./leaveBalancePolicy.js";
import {
  assertCanImportLeaveHistory,
  buildLeaveImportRowViews,
  canImportLeaveForProfile,
  canImportLeaveRecord,
  mapEmployeeProfilesByCode,
} from "./leaveImportAccessService.js";
import { auditLeaveImportPreview } from "./leaveImportAuditService.js";
import {
  buildLeaveImportDelta,
  validateLeaveImportIdentity,
  validateLeaveImportPayload,
} from "./leaveImportPolicy.js";
import { parseLeaveImportWorkbook } from "./leaveImportWorkbookService.js";

const localized = (vi: string, zh: string): LocalizedText => ({ vi, zh });

const createBalanceSimulation = async (
  profiles: EmployeeProfile[],
): Promise<Map<string, Map<number, LeaveBalanceBucket>>> => {
  const entries = await Promise.all(
    profiles.map(async (profile) => [
      profile.id,
      new Map(
        (await findLeaveBalanceBuckets(profile.id)).map((bucket) => [
          bucket.leave_year,
          bucket,
        ]),
      ),
    ] as const),
  );
  return new Map(entries);
};

export const previewLeaveHistoryImport = async (
  input: PreviewLeaveImportInput,
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveImportBatchView> => {
  assertCanImportLeaveHistory(authorization);
  const [parsedRows, profiles] = await Promise.all([
    parseLeaveImportWorkbook(input),
    findEmployeeProfiles(),
  ]);
  const profilesByCode = mapEmployeeProfilesByCode(profiles);
  const accessibleProfiles = Array.from(
    new Set(
      parsedRows
        .map((row) => profilesByCode.get(row.employee_code))
        .filter(
          (profile): profile is EmployeeProfile =>
            Boolean(profile) &&
            canImportLeaveForProfile(authorization, profile!),
        ),
    ),
  );
  const simulations = await createBalanceSimulation(accessibleProfiles);
  const duplicateKeys = new Set<string>();
  const now = new Date();
  const rows = parsedRows.map((row) => {
    const errors = validateLeaveImportIdentity(row);
    const recordType = Object.values(LeaveImportRecordType).includes(
      row.record_type as LeaveImportRecordType,
    )
      ? (row.record_type as LeaveImportRecordType)
      : null;
    if (!recordType) {
      errors.push(localized("Loại dữ liệu không hợp lệ.", "数据类型无效。"));
    }
    const profile = profilesByCode.get(row.employee_code);
    if (!profile || !canImportLeaveForProfile(authorization, profile)) {
      errors.push(
        localized(
          "Không tìm thấy nhân viên hoặc bạn không có quyền tại cơ sở của nhân viên.",
          "找不到员工，或您无权访问该员工所在设施。",
        ),
      );
    }
    if (
      profile &&
      recordType &&
      canImportLeaveForProfile(authorization, profile) &&
      !canImportLeaveRecord(authorization, profile, recordType)
    ) {
      errors.push(
        localized(
          "Bạn cần quyền điều chỉnh số dư để nhập dòng ADJUSTMENT.",
          "导入 ADJUSTMENT 行需要假期余额调整权限。",
        ),
      );
    }
    if (recordType) {
      errors.push(
        ...validateLeaveImportPayload(recordType, row.normalized_payload),
      );
    }
    const duplicateKey = `${row.employee_code}:${row.source_reference}`;
    if (duplicateKeys.has(duplicateKey)) {
      errors.push(
        localized(
          "Mã tham chiếu bị trùng trong tệp của cùng nhân viên.",
          "同一员工的来源参考编号在文件中重复。",
        ),
      );
    }
    duplicateKeys.add(duplicateKey);

    if (errors.length === 0 && profile && recordType) {
      const delta = buildLeaveImportDelta(recordType, row.normalized_payload);
      if (delta) {
        const buckets = simulations.get(profile.id)!;
        const current =
          buckets.get(row.normalized_payload.leave_year) ??
          createEmptyLeaveBalanceBucket(
            profile,
            row.normalized_payload.leave_year,
            now,
          );
        try {
          buckets.set(
            row.normalized_payload.leave_year,
            applyLeaveDelta(current, delta),
          );
        } catch {
          errors.push(
            localized(
              "Dòng này làm số dư ngày phép bị âm; hãy kiểm tra thứ tự và số ngày.",
              "该行会导致假期余额为负，请检查顺序和天数。",
            ),
          );
        }
      }
    }
    return {
      row_number: row.row_number,
      record_type: (recordType ?? row.record_type) as LeaveImportRecordType,
      source_reference: row.source_reference,
      employee_code: row.employee_code,
      normalized_payload:
        row.normalized_payload as unknown as Record<string, unknown>,
      is_valid: errors.length === 0,
      validation_messages: errors,
    };
  });

  const preview = await createLeaveImportPreview({
    source_file_name: input.source_file_name,
    source_file_url: input.source_file_url,
    source_file_checksum: input.source_file_checksum,
    workplace_warehouse_ids: Array.from(
      new Set(
        accessibleProfiles.map(
          (profile) => profile.workplace_warehouse_id,
        ),
      ),
    ),
    actor_id: actorId,
    action_time: input.action_time,
    rows,
  });
  await auditLeaveImportPreview({
    ...preview,
    actor_id: actorId,
    action_time: input.action_time,
  });
  return {
    batch: preview.batch,
    rows: buildLeaveImportRowViews(preview.rows, profilesByCode),
  };
};
