import {
  EmployeeContractImportLifecycleState,
  EmployeeContractImportRowStatus,
  type EmployeeContract,
  type EmployeeContractImportBatchView,
  type EmployeeContractImportRow,
  type PreviewEmployeeContractImportInput,
} from "@bduck/shared-types";

import {
  createEmployeeContractImportPreview,
} from "../repositories/employeeContractImportRepository.js";
import {
  findEmployeeContractByNormalizedNumber,
  findEmployeeContractsByProfileId,
} from "../repositories/employeeContractQueryRepository.js";
import { employeeContractNumberLockRef } from "../repositories/employeeContractRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanImportEmployeeContracts,
  buildEmployeeContractImportRowViews,
  canImportContractsForProfile,
} from "./employeeContractImportAccessService.js";
import { buildImportedEmployeeContract } from "./employeeContractImportContractFactory.js";
import {
  verifyEmployeeContractImportExcel,
  verifyEmployeeContractImportPdfs,
} from "./employeeContractImportStorageService.js";
import { parseEmployeeContractImportWorkbook } from "./employeeContractImportWorkbookService.js";
import {
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
  validateEmployeeContractDraft,
} from "./employeeContractPolicy.js";

const message = (vi: string, zh: string) => ({ vi, zh });

export const previewEmployeeContractImport = async (
  input: PreviewEmployeeContractImportInput,
  actorId: string,
  authorization: AuthorizationService,
): Promise<EmployeeContractImportBatchView> => {
  assertCanImportEmployeeContracts(authorization);
  const [excel, stagedPdfs, profiles] = await Promise.all([
    verifyEmployeeContractImportExcel({
      storage_path: input.source_file_path,
      expected_sha256: input.source_file_checksum,
      session_id: input.upload_session_id,
      actor_id: actorId,
    }),
    verifyEmployeeContractImportPdfs({
      files: input.pdf_files,
      session_id: input.upload_session_id,
      actor_id: actorId,
    }),
    findEmployeeProfiles(),
  ]);
  const parsedRows = await parseEmployeeContractImportWorkbook(excel);
  const profilesByCode = new Map(
    profiles.map((profile) => [
      profile.employee_code.normalize("NFKC").toUpperCase(),
      profile,
    ]),
  );
  const uniqueProfiles = Array.from(
    new Set(
      parsedRows
        .map((row) => profilesByCode.get(row.employee_code)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const contractsByProfile = new Map(
    await Promise.all(
      uniqueProfiles.map(async (id) => [
        id,
        await findEmployeeContractsByProfileId(id),
      ] as const),
    ),
  );
  const numbers = Array.from(
    new Set(
      parsedRows
        .map((row) =>
          normalizeEmployeeContractNumber(
            row.normalized_payload.contract_number,
          ),
        )
        .filter(Boolean),
    ),
  );
  const occupiedNumbers = new Set(
    (
      await Promise.all(
        numbers.map(async (number) => {
          const [lock, contract] = await Promise.all([
            employeeContractNumberLockRef(number).get(),
            findEmployeeContractByNormalizedNumber(number),
          ]);
          return [number, lock.exists || Boolean(contract)] as const;
        }),
      )
    )
      .filter((entry) => entry[1])
      .map((entry) => entry[0]),
  );
  const seenNumbers = new Set<string>();
  const usedPdfs = new Set<string>();
  const simulated = new Map<string, EmployeeContract[]>();
  const rows: Array<
    Pick<
      EmployeeContractImportRow,
      | "row_number"
      | "source_reference"
      | "employee_code"
      | "employee_profile_id"
      | "workplace_warehouse_id"
      | "normalized_payload"
      | "status"
      | "validation_messages"
      | "staged_document"
    >
  > = parsedRows.map((row) => {
    const issues = [...row.parse_messages];
    const profile = profilesByCode.get(row.employee_code);
    const payload = row.normalized_payload;
    if (!profile) {
      issues.push(message("Không tìm thấy mã nhân viên.", "找不到员工编号。"));
    } else if (!canImportContractsForProfile(authorization, profile)) {
      issues.push(
        message(
          "Không có quyền import tại cơ sở của nhân viên.",
          "无权在该员工所属场所导入。",
        ),
      );
    }
    if (payload.lifecycle_state && (!payload.lifecycle_date || !payload.lifecycle_reason)) {
      issues.push(
        message(
          "Hợp đồng đã hủy/chấm dứt phải có ngày và lý do.",
          "已取消/终止的合同必须填写日期和原因。",
        ),
      );
    }
    if (!payload.lifecycle_state && (payload.lifecycle_date || payload.lifecycle_reason)) {
      issues.push(
        message(
          "Có ngày/lý do lịch sử nhưng chưa chọn trạng thái.",
          "已填写历史日期/原因，但未选择状态。",
        ),
      );
    }
    if (
      (payload.lifecycle_reason?.length ?? 0) > 1000 ||
      (payload.notes?.length ?? 0) > 2000
    ) {
      issues.push(
        message(
          "Lý do tối đa 1.000 ký tự và ghi chú tối đa 2.000 ký tự.",
          "原因最多 1,000 个字符，备注最多 2,000 个字符。",
        ),
      );
    }
    if (
      payload.lifecycle_state === EmployeeContractImportLifecycleState.TERMINATED &&
      payload.lifecycle_date &&
      (payload.lifecycle_date < payload.start_date ||
        Boolean(payload.end_date && payload.lifecycle_date > payload.end_date))
    ) {
      issues.push(
        message(
          "Ngày chấm dứt phải nằm trong thời gian hợp đồng.",
          "终止日期必须在合同期限内。",
        ),
      );
    }
    if (
      payload.lifecycle_state === EmployeeContractImportLifecycleState.CANCELLED &&
      payload.lifecycle_date &&
      payload.lifecycle_date > payload.start_date
    ) {
      issues.push(
        message(
          "Hợp đồng chỉ được hủy trước hoặc tại ngày bắt đầu; sau đó phải dùng chấm dứt.",
          "合同只能在开始日或之前取消；之后应使用终止。",
        ),
      );
    }
    const normalizedNumber = normalizeEmployeeContractNumber(
      payload.contract_number,
    );
    if (
      normalizedNumber &&
      (seenNumbers.has(normalizedNumber) ||
        occupiedNumbers.has(normalizedNumber))
    ) {
      issues.push(
        message(
          "Số hợp đồng đã tồn tại trong hệ thống hoặc trong batch.",
          "合同编号已存在于系统或当前批次中。",
        ),
      );
    }
    seenNumbers.add(normalizedNumber);
    let stagedDocument = null;
    if (payload.pdf_file_name) {
      const key = payload.pdf_file_name.normalize("NFKC").toLowerCase();
      stagedDocument = stagedPdfs.get(key) ?? null;
      if (!stagedDocument) {
        issues.push(message("Không tìm thấy tệp PDF đã khai báo.", "找不到指定的 PDF 文件。"));
      } else if (usedPdfs.has(key)) {
        issues.push(message("Một tệp PDF chỉ được gắn cho một dòng.", "一个 PDF 文件只能关联一行。"));
      }
      usedPdfs.add(key);
    }
    if (profile && payload.contract_type) {
      const existing = [
        ...(contractsByProfile.get(profile.id) ?? []),
        ...(simulated.get(profile.id) ?? []),
      ];
      const previewTime = new Date();
      const candidate = buildImportedEmployeeContract({
        id: `preview-${row.row_number}`,
        payload,
        profile,
        actor_id: actorId,
        action_time: previewTime,
        sync_time: previewTime,
      });
      const policyIssues = validateEmployeeContractDraft(
        profile.id,
        {
          contract_number: payload.contract_number,
          contract_type: payload.contract_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
        },
        existing,
      ).filter((issue) => issue.code !== "CONTRACT_PERIOD_OVERLAP");
      issues.push(...policyIssues.map((issue) => issue.messages));
      if (
        existing.some((contract) =>
          doEmployeeContractPeriodsOverlap(candidate, contract),
        )
      ) {
        issues.push(
          message(
            "Nhân viên đã có hợp đồng trong khoảng thời gian này.",
            "该员工在此时间段内已有合同。",
          ),
        );
      }
      if (issues.length === 0) {
        simulated.set(profile.id, [
          ...(simulated.get(profile.id) ?? []),
          candidate,
        ]);
      }
    }
    return {
      row_number: row.row_number,
      source_reference: row.source_reference,
      employee_code: row.employee_code,
      employee_profile_id: profile?.id ?? null,
      workplace_warehouse_id: profile?.workplace_warehouse_id ?? null,
      normalized_payload: payload,
      status:
        issues.length === 0
          ? EmployeeContractImportRowStatus.VALID
          : EmployeeContractImportRowStatus.INVALID,
      validation_messages: issues,
      staged_document: stagedDocument,
    };
  });
  const created = await createEmployeeContractImportPreview({
    source_file_name: input.source_file_name,
    source_file_path: input.source_file_path,
    source_file_checksum: input.source_file_checksum,
    upload_session_id: input.upload_session_id,
    workplace_warehouse_ids: Array.from(
      new Set(
        rows
          .map((row) => row.workplace_warehouse_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
    actor_id: actorId,
    action_time: input.action_time,
    rows,
  });
  return {
    batch: created.batch,
    rows: buildEmployeeContractImportRowViews(created.rows, profilesByCode),
  };
};
