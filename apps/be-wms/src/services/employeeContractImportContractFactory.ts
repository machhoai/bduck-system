import {
  EmployeeContractImportLifecycleState,
  EmployeeContractStatus,
  type EmployeeContract,
  type EmployeeContractImportNormalizedPayload,
  type EmployeeProfile,
} from "@bduck/shared-types";

import {
  normalizeEmployeeContractNumber,
  resolveEmployeeContractStatus,
} from "./employeeContractPolicy.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";

export const buildImportedEmployeeContract = (input: {
  id: string;
  payload: EmployeeContractImportNormalizedPayload;
  profile: EmployeeProfile;
  actor_id: string;
  action_time: Date;
  sync_time: Date;
}): EmployeeContract => {
  const cancelled =
    input.payload.lifecycle_state ===
    EmployeeContractImportLifecycleState.CANCELLED;
  const terminated =
    input.payload.lifecycle_state ===
    EmployeeContractImportLifecycleState.TERMINATED;
  const base: EmployeeContract = {
    id: input.id,
    employee_profile_id: input.profile.id,
    employee_user_id: input.profile.user_id,
    workplace_warehouse_id: input.profile.workplace_warehouse_id,
    contract_number: input.payload.contract_number,
    contract_number_normalized: normalizeEmployeeContractNumber(
      input.payload.contract_number,
    ),
    contract_type: input.payload.contract_type!,
    start_date: input.payload.start_date,
    end_date: input.payload.end_date,
    status: cancelled
      ? EmployeeContractStatus.CANCELLED
      : EmployeeContractStatus.UPCOMING,
    renewed_from_contract_id: null,
    root_contract_id: input.id,
    renewal_sequence: 0,
    termination_date: terminated ? input.payload.lifecycle_date : null,
    termination_reason: terminated ? input.payload.lifecycle_reason : null,
    terminated_by: terminated ? input.actor_id : null,
    terminated_at: terminated ? input.sync_time : null,
    cancellation_reason: cancelled ? input.payload.lifecycle_reason : null,
    cancelled_by: cancelled ? input.actor_id : null,
    cancelled_at: cancelled ? input.sync_time : null,
    notes: input.payload.notes,
    revision: 1,
    created_by: input.actor_id,
    updated_by: input.actor_id,
    is_deleted: false,
    created_at: input.sync_time,
    updated_at: input.sync_time,
    action_time: input.action_time,
    sync_time: input.sync_time,
  };
  return {
    ...base,
    status: cancelled
      ? EmployeeContractStatus.CANCELLED
      : resolveEmployeeContractStatus(
          base,
          getVietnamLocalDate(input.sync_time),
        ),
  };
};
