import {
  EmployeeContractImportLifecycleState,
  type EmployeeContract,
  type EmployeeProfile,
  type LocalizedText,
} from "@bduck/shared-types";
import type { ParsedEmployeeContractImportRow } from "./employeeContractImportWorkbookService.js";
import { buildImportedEmployeeContract } from "./employeeContractImportContractFactory.js";
import {
  doEmployeeContractPeriodsOverlap,
  normalizeEmployeeContractNumber,
  validateEmployeeContractDraft,
} from "./employeeContractPolicy.js";

export interface EmployeeContractLegacyMigrationRowPlan {
  row_number: number;
  employee_code: string;
  profile: EmployeeProfile | null;
  candidate: EmployeeContract | null;
  messages: LocalizedText[];
}

const message = (vi: string, zh: string): LocalizedText => ({ vi, zh });

export const planEmployeeContractLegacyMigration = (input: {
  rows: ParsedEmployeeContractImportRow[];
  profiles: EmployeeProfile[];
  existing_contracts: EmployeeContract[];
  actor_id: string;
  now: Date;
}): EmployeeContractLegacyMigrationRowPlan[] => {
  const profilesByCode = new Map(
    input.profiles.map((profile) => [
      profile.employee_code.normalize("NFKC").trim().toUpperCase(),
      profile,
    ]),
  );
  const occupiedNumbers = new Set(
    input.existing_contracts.map((contract) =>
      normalizeEmployeeContractNumber(contract.contract_number),
    ),
  );
  const seenNumbers = new Set<string>();
  const simulated = new Map<string, EmployeeContract[]>();

  return input.rows.map((row) => {
    const messages = [...row.parse_messages];
    const payload = row.normalized_payload;
    const profile = profilesByCode.get(row.employee_code) ?? null;
    if (!profile) {
      messages.push(
        message("Không tìm thấy mã nhân viên.", "找不到员工编号。"),
      );
    }
    if (payload.pdf_file_name) {
      messages.push(
        message(
          "CLI migration không nhận PDF; hãy upload PDF sau bằng chức năng import trên giao diện.",
          "迁移 CLI 不接收 PDF；请稍后通过界面导入功能上传 PDF。",
        ),
      );
    }
    if (
      payload.lifecycle_state &&
      (!payload.lifecycle_date || !payload.lifecycle_reason)
    ) {
      messages.push(
        message(
          "Hợp đồng đã hủy/chấm dứt phải có ngày và lý do.",
          "已取消/终止的合同必须填写日期和原因。",
        ),
      );
    }
    if (
      !payload.lifecycle_state &&
      (payload.lifecycle_date || payload.lifecycle_reason)
    ) {
      messages.push(
        message(
          "Có ngày/lý do lịch sử nhưng chưa chọn trạng thái.",
          "已填写历史日期/原因，但未选择状态。",
        ),
      );
    }
    if (
      payload.lifecycle_state ===
        EmployeeContractImportLifecycleState.TERMINATED &&
      payload.lifecycle_date &&
      (payload.lifecycle_date < payload.start_date ||
        Boolean(
          payload.end_date && payload.lifecycle_date > payload.end_date,
        ))
    ) {
      messages.push(
        message(
          "Ngày chấm dứt phải nằm trong thời gian hợp đồng.",
          "终止日期必须在合同有效期内。",
        ),
      );
    }
    if (
      payload.lifecycle_state ===
        EmployeeContractImportLifecycleState.CANCELLED &&
      payload.lifecycle_date &&
      payload.lifecycle_date > payload.start_date
    ) {
      messages.push(
        message(
          "Hợp đồng chỉ được hủy trước hoặc tại ngày bắt đầu.",
          "合同只能在开始日期当天或之前取消。",
        ),
      );
    }
    const normalized = normalizeEmployeeContractNumber(
      payload.contract_number,
    );
    if (
      normalized &&
      (occupiedNumbers.has(normalized) || seenNumbers.has(normalized))
    ) {
      messages.push(
        message(
          "Số hợp đồng đã tồn tại trong hệ thống hoặc workbook.",
          "合同编号已存在于系统或工作簿中。",
        ),
      );
    }
    seenNumbers.add(normalized);

    let candidate: EmployeeContract | null = null;
    if (profile && payload.contract_type) {
      const existing = [
        ...input.existing_contracts.filter(
          (contract) => contract.employee_profile_id === profile.id,
        ),
        ...(simulated.get(profile.id) ?? []),
      ];
      candidate = buildImportedEmployeeContract({
        id: `legacy-preview-${row.row_number}`,
        payload,
        profile,
        actor_id: input.actor_id,
        action_time: input.now,
        sync_time: input.now,
      });
      messages.push(
        ...validateEmployeeContractDraft(
          profile.id,
          {
            contract_number: payload.contract_number,
            contract_type: payload.contract_type,
            start_date: payload.start_date,
            end_date: payload.end_date,
          },
          existing,
        )
          .filter((issue) => issue.code !== "CONTRACT_PERIOD_OVERLAP")
          .map((issue) => issue.messages),
      );
      if (
        existing.some((contract) =>
          doEmployeeContractPeriodsOverlap(candidate!, contract),
        )
      ) {
        messages.push(
          message(
            "Nhân viên đã có hợp đồng trong khoảng thời gian này.",
            "该员工在此时间段内已有合同。",
          ),
        );
      }
    }
    if (candidate && messages.length === 0 && profile) {
      simulated.set(profile.id, [
        ...(simulated.get(profile.id) ?? []),
        candidate,
      ]);
    }
    return {
      row_number: row.row_number,
      employee_code: row.employee_code,
      profile,
      candidate: messages.length === 0 ? candidate : null,
      messages,
    };
  });
};
