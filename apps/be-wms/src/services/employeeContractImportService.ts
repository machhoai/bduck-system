import {
  EmployeeContractImportBatchStatus,
  EmployeeContractImportRowStatus,
  type CommitEmployeeContractImportInput,
  type EmployeeContractImportCommitResult,
} from "@bduck/shared-types";

import {
  commitEmployeeContractImportRow,
} from "../repositories/employeeContractImportCommitRepository.js";
import { markEmployeeContractImportRowFailed } from "../repositories/employeeContractImportRowRepository.js";
import {
  findEmployeeContractImportBatch,
  findEmployeeContractImportRows,
  transitionEmployeeContractImportBatch,
} from "../repositories/employeeContractImportRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import type { EmployeeContractAuditMetadata } from "../repositories/employeeContractRepository.js";
import {
  assertEmployeeContractImportBatchAccess,
  canImportContractsForProfile,
} from "./employeeContractImportAccessService.js";
import { persistEmployeeContractImportPdf } from "./employeeContractImportStorageService.js";
import type { AuthorizationService } from "./authorization/index.js";

const apiError = (
  code: string,
  vi: string,
  zh: string,
  statusCode = 409,
) => ({ code, statusCode, messages: { vi, zh } });

export const commitEmployeeContractImport = async (
  batchId: string,
  input: CommitEmployeeContractImportInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: EmployeeContractAuditMetadata = {},
): Promise<EmployeeContractImportCommitResult> => {
  const existing = await findEmployeeContractImportBatch(batchId);
  if (!existing) {
    throw apiError(
      "CONTRACT_IMPORT_BATCH_NOT_FOUND",
      "Không tìm thấy batch import.",
      "找不到导入批次。",
      404,
    );
  }
  assertEmployeeContractImportBatchAccess(existing, actorId, authorization);
  if (existing.source_file_checksum !== input.expected_batch_checksum) {
    throw apiError(
      "CONTRACT_IMPORT_CHECKSUM_MISMATCH",
      "Checksum batch không khớp với bản preview.",
      "批次校验和与预览不匹配。",
    );
  }
  if (existing.invalid_rows > 0) {
    throw apiError(
      "CONTRACT_IMPORT_HAS_INVALID_ROWS",
      "Hãy sửa toàn bộ dòng lỗi trước khi commit.",
      "提交前请修正所有错误行。",
      422,
    );
  }
  if (
    existing.status === EmployeeContractImportBatchStatus.COMPLETED &&
    existing.commit_idempotency_key === input.idempotency_key
  ) {
    return {
      batch: existing,
      committed_rows: existing.committed_rows,
      duplicate_rows: existing.committed_rows,
    };
  }
  await transitionEmployeeContractImportBatch({
    batch_id: batchId,
    actor_id: actorId,
    action_time: input.action_time,
    status: EmployeeContractImportBatchStatus.COMMITTING,
    idempotency_key: input.idempotency_key,
    failure_message: null,
  });
  const [rows, profiles] = await Promise.all([
    findEmployeeContractImportRows(batchId),
    findEmployeeProfiles(),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  let committed = 0;
  let duplicates = 0;
  let failed = 0;
  for (const row of rows) {
    if (
      row.status !== EmployeeContractImportRowStatus.VALID &&
      row.status !== EmployeeContractImportRowStatus.FAILED &&
      row.status !== EmployeeContractImportRowStatus.COMMITTED
    ) {
      continue;
    }
    const profile = row.employee_profile_id
      ? profilesById.get(row.employee_profile_id)
      : null;
    if (!profile || !canImportContractsForProfile(authorization, profile)) {
      failed++;
      await markEmployeeContractImportRowFailed(
        row.id,
        actorId,
        input.action_time,
        "CONTRACT_IMPORT_PROFILE_OR_PERMISSION_CHANGED",
        {
          vi: "Thông tin nhân viên hoặc quyền tại cơ sở đã thay đổi sau preview.",
          zh: "预览后员工信息或场所权限已更改。",
        },
      );
      continue;
    }
    try {
      const persisted = row.staged_document
        ? await persistEmployeeContractImportPdf(
            row.staged_document,
            batchId,
            row.id,
          )
        : null;
      const result = await commitEmployeeContractImportRow({
        batch_id: batchId,
        row_id: row.id,
        profile,
        persisted_document: persisted,
        expected_batch_checksum: input.expected_batch_checksum,
        context: {
          actor_id: actorId,
          action_time: input.action_time,
          idempotency_key: `${input.idempotency_key}:${row.id}`,
          ...metadata,
        },
      });
      committed++;
      if (result.duplicate) duplicates++;
    } catch (error) {
      failed++;
      const apiFailure = error as {
        code?: string;
        messages?: { vi: string; zh: string };
      };
      await markEmployeeContractImportRowFailed(
        row.id,
        actorId,
        input.action_time,
        String(apiFailure.code ?? "CONTRACT_IMPORT_ROW_FAILED"),
        apiFailure.messages ?? {
          vi: "Không thể commit dòng hợp đồng này.",
          zh: "无法提交此合同记录。",
        },
      );
    }
  }
  const status =
    failed > 0
      ? EmployeeContractImportBatchStatus.FAILED
      : EmployeeContractImportBatchStatus.COMPLETED;
  const batch = await transitionEmployeeContractImportBatch({
    batch_id: batchId,
    actor_id: actorId,
    action_time: input.action_time,
    status,
    idempotency_key: input.idempotency_key,
    committed_rows: committed,
    failed_rows: failed,
    failure_message:
      failed > 0
        ? {
            vi: `${failed} dòng không thể commit. Có thể sửa nguyên nhân và thử lại cùng khóa.`,
            zh: `${failed} 行无法提交。可修正原因后使用同一幂等键重试。`,
          }
        : null,
  });
  return { batch, committed_rows: committed, duplicate_rows: duplicates };
};
