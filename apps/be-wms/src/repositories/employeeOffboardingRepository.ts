import { randomUUID } from "node:crypto";

import {
  AuditAction,
  EmployeeIdentitySyncJobStatus,
  UserStatus,
  addContractLocalDays,
  type EmployeeEmploymentTransition,
  type EmployeeIdentitySyncJob,
  type EmployeeProfile,
  type User,
  type UserWarehouseRole,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export interface EmployeeOffboardingState {
  userId: string;
  userRef: FirebaseFirestore.DocumentReference;
  user: User | null;
  accessRef: FirebaseFirestore.DocumentReference;
  access: Record<string, unknown> | null;
  assignments: Array<{
    ref: FirebaseFirestore.DocumentReference;
    value: UserWarehouseRole;
  }>;
}

export interface EmployeeOffboardingAuditMetadata {
  action_time?: Date;
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
}

interface TransactionAuditInput {
  entityType: string;
  entityId: string;
  warehouseId: string | null;
  action: AuditAction;
  actorId: string;
  entityName: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  actionTime: Date;
  syncTime: Date;
  metadata?: EmployeeOffboardingAuditMetadata;
  notes?: string;
}

const writeAudit = (
  transaction: FirebaseFirestore.Transaction,
  input: TransactionAuditInput,
) => {
  const ref = db.collection("audit_logs").doc(randomUUID());
  transaction.create(ref, {
    id: ref.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    warehouse_id: input.warehouseId,
    action: input.action,
    user_id: input.actorId,
    user_name: null,
    entity_name: input.entityName,
    action_time: input.actionTime,
    sync_time: input.syncTime,
    old_value: input.oldValue,
    new_value: input.newValue,
    ip_address: input.metadata?.ip_address ?? null,
    device_id: input.metadata?.device_id ?? null,
    session_token: input.metadata?.session_token ?? null,
    notes: input.notes ?? null,
  });
};

export const reconcileEmployeeOffboardingProjection = async (input: {
  employeeProfileId: string;
  effectiveDate: string;
  actorId: string;
  forceIdentitySync?: boolean;
}): Promise<{ changed: boolean; identitySyncJobId: string | null }> =>
  db.runTransaction(async (transaction) => {
    const profileRef = db
      .collection("employee_profiles")
      .doc(input.employeeProfileId);
    const jobId = `reconciliation-${input.employeeProfileId}-${input.effectiveDate}`;
    const jobRef = db.collection("employee_identity_sync_jobs").doc(jobId);
    const [profileSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(jobRef),
    ]);
    if (
      !profileSnapshot.exists ||
      profileSnapshot.data()?.is_deleted === true
    ) {
      return { changed: false, identitySyncJobId: null };
    }

    const profile: EmployeeProfile = {
      id: profileSnapshot.id,
      ...(profileSnapshot.data() as Omit<EmployeeProfile, "id">),
    };
    if (
      profile.employment_status !== "RESIGNED" ||
      profile.resignation_date !== input.effectiveDate ||
      !profile.user_id
    ) {
      return { changed: false, identitySyncJobId: null };
    }

    const state = await loadEmployeeOffboardingState(
      transaction,
      profile.user_id,
    );
    if (!state) return { changed: false, identitySyncJobId: null };

    const now = new Date();
    let changed = false;
    if (profile.status !== "INACTIVE") {
      const profileAfter = { ...profile, status: "INACTIVE", updated_at: now };
      transaction.update(profileRef, {
        status: "INACTIVE",
        updated_at: now,
      });
      writeAudit(transaction, {
        entityType: "employee_profiles",
        entityId: profile.id,
        warehouseId: profile.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        actorId: input.actorId,
        entityName: profile.full_name,
        oldValue: profile as unknown as Record<string, unknown>,
        newValue: profileAfter as unknown as Record<string, unknown>,
        actionTime: now,
        syncTime: now,
        notes: "Reconcile resigned employee profile",
      });
      changed = true;
    }

    if (
      state.user &&
      (state.user.status !== UserStatus.INACTIVE ||
        state.user.status_reason !== "EMPLOYMENT_RESIGNED" ||
        state.user.status_effective_date !== input.effectiveDate)
    ) {
      const userPatch = {
        status: UserStatus.INACTIVE,
        status_reason: "EMPLOYMENT_RESIGNED" as const,
        status_effective_date: input.effectiveDate,
        status_source_id: `reconciliation:${profile.id}`,
        deactivated_at: now,
        deactivated_by: input.actorId,
        updated_at: now,
      };
      transaction.update(state.userRef, userPatch);
      writeAudit(transaction, {
        entityType: "users",
        entityId: state.userId,
        warehouseId: profile.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        actorId: input.actorId,
        entityName: profile.full_name,
        oldValue: state.user as unknown as Record<string, unknown>,
        newValue: {
          ...(state.user as unknown as Record<string, unknown>),
          ...userPatch,
        },
        actionTime: now,
        syncTime: now,
        notes: "Reconcile linked account for resigned employee",
      });
      changed = true;
    }

    const assignmentValidUntil =
      addContractLocalDays(input.effectiveDate, -1) ?? input.effectiveDate;
    for (const assignment of state.assignments) {
      if (!assignment.value.is_active) continue;
      const assignmentPatch = {
        is_active: false,
        valid_until: assignmentValidUntil,
        updated_at: now,
      };
      transaction.update(assignment.ref, assignmentPatch);
      writeAudit(transaction, {
        entityType: "user_warehouse_roles",
        entityId: assignment.value.id,
        warehouseId: assignment.value.warehouse_id,
        action: AuditAction.UPDATE,
        actorId: input.actorId,
        entityName: profile.full_name,
        oldValue: assignment.value as unknown as Record<string, unknown>,
        newValue: {
          ...(assignment.value as unknown as Record<string, unknown>),
          ...assignmentPatch,
        },
        actionTime: now,
        syncTime: now,
        notes: "Reconcile role assignment for resigned employee",
      });
      changed = true;
    }

    if (state.access && state.access.is_deleted !== true) {
      const accessPatch = {
        is_deleted: true,
        updated_at: now,
        action_time: now,
        sync_time: now,
      };
      transaction.update(state.accessRef, accessPatch);
      writeAudit(transaction, {
        entityType: "user_access",
        entityId: state.userId,
        warehouseId: profile.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        actorId: input.actorId,
        entityName: profile.full_name,
        oldValue: state.access,
        newValue: { ...state.access, ...accessPatch },
        actionTime: now,
        syncTime: now,
        notes: "Reconcile materialized access for resigned employee",
      });
      changed = true;
    }

    const existingJob = jobSnapshot.exists
      ? mapIdentitySyncJob(jobSnapshot)
      : null;
    const shouldQueueIdentitySync =
      input.forceIdentitySync === true ||
      !existingJob ||
      existingJob.status !== EmployeeIdentitySyncJobStatus.SUCCEEDED;
    if (shouldQueueIdentitySync) {
      const job: EmployeeIdentitySyncJob = {
        id: jobId,
        employee_profile_id: profile.id,
        employee_user_id: state.userId,
        employment_transition_id: `reconciliation:${profile.id}`,
        desired_disabled: true,
        status: EmployeeIdentitySyncJobStatus.PENDING,
        retry_count: 0,
        next_retry_at: now,
        lease_expires_at: null,
        last_error: null,
        requested_by: input.actorId,
        completed_at: null,
        is_deleted: false,
        created_at: existingJob?.created_at ?? now,
        updated_at: now,
        action_time: now,
        sync_time: now,
      };
      transaction.set(jobRef, job);
      writeAudit(transaction, {
        entityType: "employee_identity_sync_jobs",
        entityId: jobId,
        warehouseId: profile.workplace_warehouse_id,
        action: existingJob ? AuditAction.UPDATE : AuditAction.CREATE,
        actorId: input.actorId,
        entityName: profile.full_name,
        oldValue: existingJob as unknown as Record<string, unknown> | null,
        newValue: job as unknown as Record<string, unknown>,
        actionTime: now,
        syncTime: now,
        notes: "Queue identity reconciliation for resigned employee",
      });
      changed = true;
    }

    return {
      changed,
      identitySyncJobId: shouldQueueIdentitySync ? jobId : null,
    };
  });

const mapIdentitySyncJob = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeIdentitySyncJob => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<EmployeeIdentitySyncJob, "id">),
});

export const loadEmployeeOffboardingState = async (
  transaction: FirebaseFirestore.Transaction,
  userId: string | null,
): Promise<EmployeeOffboardingState | null> => {
  if (!userId) return null;

  const userRef = db.collection("users").doc(userId);
  const accessRef = db.collection("user_access").doc(userId);
  const assignmentsQuery = db
    .collection("user_warehouse_roles")
    .where("user_id", "==", userId);
  const [userSnapshot, accessSnapshot, assignmentsSnapshot] = await Promise.all(
    [
      transaction.get(userRef),
      transaction.get(accessRef),
      transaction.get(assignmentsQuery),
    ],
  );

  return {
    userId,
    userRef,
    user: userSnapshot.exists
      ? ({
          id: userSnapshot.id,
          ...(userSnapshot.data() as Omit<User, "id">),
        } satisfies User)
      : null,
    accessRef,
    access: accessSnapshot.exists
      ? (accessSnapshot.data() as Record<string, unknown>)
      : null,
    assignments: assignmentsSnapshot.docs.map((snapshot) => ({
      ref: snapshot.ref,
      value: {
        id: snapshot.id,
        ...(snapshot.data() as Omit<UserWarehouseRole, "id">),
      },
    })),
  };
};

export const applyEmployeeOffboardingWrites = (
  transaction: FirebaseFirestore.Transaction,
  input: {
    transitionBefore: EmployeeEmploymentTransition | null;
    transitionAfter: EmployeeEmploymentTransition;
    profileBefore: EmployeeProfile;
    profileAfter: EmployeeProfile;
    state: EmployeeOffboardingState | null;
    actorId: string;
    actionTime: Date;
    syncTime: Date;
    metadata?: EmployeeOffboardingAuditMetadata;
  },
): string | null => {
  const warehouseId = input.profileAfter.workplace_warehouse_id;
  const entityName = input.profileAfter.full_name;

  writeAudit(transaction, {
    entityType: "employee_employment_transitions",
    entityId: input.transitionAfter.id,
    warehouseId,
    action: input.transitionBefore ? AuditAction.UPDATE : AuditAction.CREATE,
    actorId: input.actorId,
    entityName,
    oldValue: input.transitionBefore as unknown as Record<
      string,
      unknown
    > | null,
    newValue: input.transitionAfter as unknown as Record<string, unknown>,
    actionTime: input.actionTime,
    syncTime: input.syncTime,
    metadata: input.metadata,
    notes: "Apply employee resignation transition",
  });
  writeAudit(transaction, {
    entityType: "employee_profiles",
    entityId: input.profileAfter.id,
    warehouseId,
    action: AuditAction.UPDATE,
    actorId: input.actorId,
    entityName,
    oldValue: input.profileBefore as unknown as Record<string, unknown>,
    newValue: input.profileAfter as unknown as Record<string, unknown>,
    actionTime: input.actionTime,
    syncTime: input.syncTime,
    metadata: input.metadata,
    notes: "Deactivate employee profile on resignation",
  });

  if (!input.state) return null;

  const statusPatch = {
    status: UserStatus.INACTIVE,
    status_reason: "EMPLOYMENT_RESIGNED" as const,
    status_effective_date: input.transitionAfter.effective_date,
    status_source_id: input.transitionAfter.id,
    deactivated_at: input.syncTime,
    deactivated_by: input.actorId,
    updated_at: input.syncTime,
  };
  if (input.state.user) {
    transaction.update(input.state.userRef, statusPatch);
    writeAudit(transaction, {
      entityType: "users",
      entityId: input.state.userId,
      warehouseId,
      action: AuditAction.UPDATE,
      actorId: input.actorId,
      entityName,
      oldValue: input.state.user as unknown as Record<string, unknown>,
      newValue: {
        ...(input.state.user as unknown as Record<string, unknown>),
        ...statusPatch,
      },
      actionTime: input.actionTime,
      syncTime: input.syncTime,
      metadata: input.metadata,
      notes: "Deactivate linked account on employee resignation",
    });
  }

  const assignmentValidUntil =
    addContractLocalDays(input.transitionAfter.effective_date, -1) ??
    input.transitionAfter.effective_date;
  for (const assignment of input.state.assignments) {
    if (!assignment.value.is_active) continue;
    const assignmentPatch = {
      is_active: false,
      valid_until: assignmentValidUntil,
      updated_at: input.syncTime,
    };
    transaction.update(assignment.ref, assignmentPatch);
    writeAudit(transaction, {
      entityType: "user_warehouse_roles",
      entityId: assignment.value.id,
      warehouseId: assignment.value.warehouse_id,
      action: AuditAction.UPDATE,
      actorId: input.actorId,
      entityName,
      oldValue: assignment.value as unknown as Record<string, unknown>,
      newValue: {
        ...(assignment.value as unknown as Record<string, unknown>),
        ...assignmentPatch,
      },
      actionTime: input.actionTime,
      syncTime: input.syncTime,
      metadata: input.metadata,
      notes: "Close role assignment on employee resignation",
    });
  }

  if (input.state.access) {
    const accessPatch = {
      is_deleted: true,
      updated_at: input.syncTime,
      action_time: input.actionTime,
      sync_time: input.syncTime,
    };
    transaction.update(input.state.accessRef, accessPatch);
    writeAudit(transaction, {
      entityType: "user_access",
      entityId: input.state.userId,
      warehouseId,
      action: AuditAction.UPDATE,
      actorId: input.actorId,
      entityName,
      oldValue: input.state.access,
      newValue: { ...input.state.access, ...accessPatch },
      actionTime: input.actionTime,
      syncTime: input.syncTime,
      metadata: input.metadata,
      notes: "Invalidate materialized access on employee resignation",
    });
  }

  const jobId = `employment-${input.transitionAfter.id}`;
  const job: EmployeeIdentitySyncJob = {
    id: jobId,
    employee_profile_id: input.profileAfter.id,
    employee_user_id: input.state.userId,
    employment_transition_id: input.transitionAfter.id,
    desired_disabled: true,
    status: EmployeeIdentitySyncJobStatus.PENDING,
    retry_count: 0,
    next_retry_at: input.syncTime,
    lease_expires_at: null,
    last_error: null,
    requested_by: input.actorId,
    completed_at: null,
    is_deleted: false,
    created_at: input.syncTime,
    updated_at: input.syncTime,
    action_time: input.actionTime,
    sync_time: input.syncTime,
  };
  transaction.set(db.collection("employee_identity_sync_jobs").doc(jobId), job);
  writeAudit(transaction, {
    entityType: "employee_identity_sync_jobs",
    entityId: jobId,
    warehouseId,
    action: AuditAction.CREATE,
    actorId: input.actorId,
    entityName,
    oldValue: null,
    newValue: job as unknown as Record<string, unknown>,
    actionTime: input.actionTime,
    syncTime: input.syncTime,
    metadata: input.metadata,
    notes: "Queue Firebase Authentication deactivation",
  });
  return jobId;
};
