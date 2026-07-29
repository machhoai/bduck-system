import type {
  EmployeeContract,
  EmployeeProfile,
  LocalizedText,
} from "@bduck/shared-types";

import {
  contractError,
  mapEmployeeContractSnapshot,
} from "./employeeContractRepository.js";

export const assertEmployeeProfileSnapshot = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeProfile => {
  if (!snapshot.exists || snapshot.get("is_deleted") === true) {
    throw contractError(
      "EMPLOYEE_PROFILE_NOT_FOUND",
      {
        vi: "Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.",
        zh: "员工档案不存在或已被删除。",
      },
      404,
    );
  }
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<EmployeeProfile, "id">),
  };
};

export const throwEmployeeContractPolicyIssues = (
  issues: readonly {
    code: string;
    messages: LocalizedText;
    field?: string;
    conflicting_contract_id?: string;
  }[],
) => {
  const first = issues[0];
  if (!first) return;
  const conflictCodes = new Set([
    "CONTRACT_NUMBER_DUPLICATE",
    "CONTRACT_PERIOD_OVERLAP",
    "CONTRACT_RENEWAL_NOT_ALLOWED",
    "CONTRACT_RENEWAL_ALREADY_EXISTS",
    "CONTRACT_RENEWAL_TYPE_MISMATCH",
    "CONTRACT_RENEWAL_START_MISMATCH",
    "CONTRACT_CANCELLATION_NOT_ALLOWED",
    "CONTRACT_TERMINATION_NOT_ALLOWED",
  ]);
  throw contractError(
    first.code,
    first.messages,
    conflictCodes.has(first.code) ? 409 : 400,
    { issues },
  );
};

export const assertEmployeeContractRevision = (
  contract: EmployeeContract,
  expectedRevision: number,
) => {
  if (contract.revision !== expectedRevision) {
    throw contractError("CONTRACT_REVISION_CONFLICT", {
      vi: "Hợp đồng đã được thay đổi ở phiên khác. Vui lòng tải dữ liệu mới.",
      zh: "合同已在其他会话中更改，请加载最新数据。",
    });
  }
};

export const assertEmployeeContractWorkplace = (
  contract: EmployeeContract,
  expectedWorkplaceId: string,
) => {
  if (contract.workplace_warehouse_id !== expectedWorkplaceId) {
    throw contractError("CONTRACT_SCOPE_CHANGED", {
      vi: "Phạm vi cơ sở của hợp đồng đã thay đổi. Vui lòng thực hiện lại yêu cầu.",
      zh: "合同的场所范围已更改，请重新执行请求。",
    });
  }
};

export const assertEmployeeContractForProfile = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
  employeeProfileId: string,
): EmployeeContract => {
  if (!snapshot.exists || snapshot.get("is_deleted") === true) {
    throw contractError(
      "CONTRACT_NOT_FOUND",
      { vi: "Không tìm thấy hợp đồng.", zh: "未找到合同。" },
      404,
    );
  }
  const contract = mapEmployeeContractSnapshot(snapshot);
  if (contract.employee_profile_id !== employeeProfileId) {
    throw contractError(
      "CONTRACT_NOT_FOUND",
      {
        vi: "Không tìm thấy hợp đồng của nhân viên.",
        zh: "未找到该员工的合同。",
      },
      404,
    );
  }
  return contract;
};
