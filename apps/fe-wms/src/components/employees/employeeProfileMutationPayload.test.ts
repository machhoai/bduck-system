import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyAccountForm,
  emptyProfileForm,
} from "./employeeProfileFormTypes.js";
import { buildEmployeeProfileMutationPayload } from "./employeeProfileMutationPayload.js";

const employmentFields = [
  "employment_status",
  "probation_start_date",
  "probation_end_date",
  "official_start_date",
  "resignation_date",
] as const;

test("edit payload omits every employment history field", () => {
  const payload = buildEmployeeProfileMutationPayload({
    form: {
      ...emptyProfileForm("warehouse-1"),
      email: "new-email@example.com",
      probation_start_date: "2026-01-01",
      probation_end_date: "2026-02-28",
      official_start_date: "2026-03-01",
    },
    isEdit: true,
    canManageEmployment: true,
    createAccount: false,
    account: emptyAccountForm(),
    assignments: [],
  });

  assert.equal(payload.email, "new-email@example.com");
  for (const field of employmentFields) {
    assert.equal(field in payload, false, `${field} must be omitted on edit`);
  }
});

test("create payload keeps employment fields when permission is granted", () => {
  const payload = buildEmployeeProfileMutationPayload({
    form: {
      ...emptyProfileForm("warehouse-1"),
      probation_start_date: "2026-01-01",
      probation_end_date: "2026-02-28",
    },
    isEdit: false,
    canManageEmployment: true,
    createAccount: false,
    account: emptyAccountForm(),
    assignments: [],
  });

  assert.equal("employment_status" in payload, true);
  assert.equal(payload.probation_start_date, "2026-01-01");
  assert.equal(payload.probation_end_date, "2026-02-28");
});
