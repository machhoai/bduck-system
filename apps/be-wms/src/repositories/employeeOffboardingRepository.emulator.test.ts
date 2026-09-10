import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeEmploymentStatus,
  EmployeeEmploymentTransitionStatus,
  EmployeeIdentitySyncJobStatus,
  EmployeeProfileStatus,
  UserStatus,
  addContractLocalDays,
} from "@bduck/shared-types";

test(
  "resignation transaction deactivates account, access and assignments atomically",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, { createEmployeeEmploymentTransitionRecord }] =
      await Promise.all([
        import("../config/firebase.js"),
        import("./employeeEmploymentTransitionRepository.js"),
      ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const profileId = `offboarding-profile-${suffix}`;
    const userId = `offboarding-user-${suffix}`;
    const assignmentId = `offboarding-assignment-${suffix}`;
    const workplaceId = `offboarding-workplace-${suffix}`;
    const effectiveDate = "2026-09-09";
    const now = new Date();

    await Promise.all([
      db.collection("employee_profiles").doc(profileId).set({
        id: profileId,
        user_id: userId,
        employee_code: `NV-${suffix}`,
        full_name: "Nhân sự nghỉ việc",
        email: "offboarding@example.com",
        phone: null,
        job_title: null,
        department: null,
        workplace_warehouse_id: workplaceId,
        status: EmployeeProfileStatus.ACTIVE,
        employment_status: EmployeeEmploymentStatus.OFFICIAL,
        official_start_date: "2026-01-01",
        resignation_date: null,
        notes: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      }),
      db.collection("users").doc(userId).set({
        id: userId,
        email: "offboarding@example.com",
        full_name: "Nhân sự nghỉ việc",
        employee_id: `NV-${suffix}`,
        workplace_facility_id: workplaceId,
        status: UserStatus.ACTIVE,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      }),
      db.collection("user_warehouse_roles").doc(assignmentId).set({
        id: assignmentId,
        user_id: userId,
        warehouse_id: workplaceId,
        role_id: "employee-role",
        is_active: true,
        valid_from: "2026-01-01",
        valid_until: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      }),
      db.collection("user_access").doc(userId).set({
        user_id: userId,
        is_deleted: false,
        grants: {},
        created_at: now,
        updated_at: now,
      }),
    ]);

    const result = await createEmployeeEmploymentTransitionRecord(
      {
        employee_profile_id: profileId,
        employee_user_id: userId,
        workplace_warehouse_id: workplaceId,
        from_status: EmployeeEmploymentStatus.OFFICIAL,
        to_status: EmployeeEmploymentStatus.RESIGNED,
        effective_date: effectiveDate,
        probation_end_date: null,
        reason: "Kết thúc quan hệ lao động",
        requested_by: `actor-${suffix}`,
        action_time: now,
      },
      {
        employment_status: EmployeeEmploymentStatus.RESIGNED,
        resignation_date: effectiveDate,
        status: EmployeeProfileStatus.INACTIVE,
      },
    );

    assert.equal(
      result.transition.status,
      EmployeeEmploymentTransitionStatus.APPLIED,
    );
    assert.equal(result.profile.status, EmployeeProfileStatus.INACTIVE);
    assert.ok(result.identitySyncJobId);

    const [profile, user, assignment, access, job, audits] = await Promise.all([
      db.collection("employee_profiles").doc(profileId).get(),
      db.collection("users").doc(userId).get(),
      db.collection("user_warehouse_roles").doc(assignmentId).get(),
      db.collection("user_access").doc(userId).get(),
      db
        .collection("employee_identity_sync_jobs")
        .doc(result.identitySyncJobId!)
        .get(),
      db
        .collection("audit_logs")
        .where("warehouse_id", "==", workplaceId)
        .get(),
    ]);

    assert.equal(profile.data()?.status, EmployeeProfileStatus.INACTIVE);
    assert.equal(user.data()?.status, UserStatus.INACTIVE);
    assert.equal(user.data()?.status_reason, "EMPLOYMENT_RESIGNED");
    assert.equal(user.data()?.status_effective_date, effectiveDate);
    assert.equal(assignment.data()?.is_active, false);
    assert.equal(
      assignment.data()?.valid_until,
      addContractLocalDays(effectiveDate, -1),
    );
    assert.equal(access.data()?.is_deleted, true);
    assert.equal(job.data()?.status, EmployeeIdentitySyncJobStatus.PENDING);
    assert.deepEqual(
      new Set(audits.docs.map((document) => document.data().entity_type)),
      new Set([
        "employee_employment_transitions",
        "employee_profiles",
        "users",
        "user_warehouse_roles",
        "user_access",
        "employee_identity_sync_jobs",
      ]),
    );
  },
);
