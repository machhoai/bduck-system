import type { AssignmentDraft } from "@/components/users/UserAssignmentEditor";

import type {
  EmployeeAccountFormState,
  EmployeeProfileFormState,
} from "./employeeProfileFormTypes";

export const buildEmployeeProfileMutationPayload = (input: {
  form: EmployeeProfileFormState;
  isEdit: boolean;
  canManageEmployment: boolean;
  createAccount: boolean;
  account: EmployeeAccountFormState;
  assignments: AssignmentDraft[];
}) => {
  const {
    employment_status,
    probation_start_date,
    probation_end_date,
    official_start_date,
    resignation_date,
    ...profileFields
  } = input.form;
  const corePayload = {
    ...profileFields,
    ...(input.canManageEmployment && !input.isEdit
      ? {
          employment_status,
          probation_start_date: probation_start_date || null,
          probation_end_date: probation_end_date || null,
          official_start_date: official_start_date || null,
          resignation_date: resignation_date || null,
        }
      : {}),
    user_id: input.createAccount ? null : input.form.user_id || null,
    email: input.form.email || null,
    phone: input.form.phone || null,
    job_title: input.form.job_title || null,
    department: input.form.department || null,
    notes: input.form.notes || null,
  };

  if (input.isEdit) return corePayload;
  return {
    ...corePayload,
    create_account: input.createAccount,
    account: input.createAccount
      ? {
          email: input.account.email,
          status: input.account.status,
          assignments: input.assignments
            .filter((assignment) => assignment.role_id)
            .map((assignment) => ({
              role_id: assignment.role_id,
              warehouse_id: assignment.warehouse_id || null,
              valid_from: assignment.valid_from,
              valid_until: assignment.valid_until || null,
              is_active: assignment.is_active,
            })),
        }
      : undefined,
  };
};
