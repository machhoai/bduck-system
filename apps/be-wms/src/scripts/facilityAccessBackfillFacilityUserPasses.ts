import { FieldPath } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getOfficeScopeConfigRef } from "../repositories/officeScopeRepository.js";
import {
  planOfficeScopeConfig,
  planUserBackfill,
  type DocumentInput,
} from "./facilityAccessBackfillPlanner.js";
import {
  checkpointReport,
  recordIssues,
  registerCommittedWrite,
  registerPlannedWrite,
} from "./facilityAccessBackfillPassUtils.js";
import {
  commitCreateWithAudit,
  commitPatchWithAudit,
  commitProgressOnly,
} from "./facilityAccessBackfillWrites.js";
import { isBackfillPreconditionConflict } from "./facilityAccessBackfillErrors.js";
import { assertCurrentUserWorkplaceSource } from "./facilityAccessBackfillUserPrecondition.js";
import type {
  BackfillMigrationState,
  RuntimeContext,
} from "./facilityAccessBackfillTypes.js";

const inputFrom = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): DocumentInput => ({ id: snapshot.id, data: snapshot.data() ?? {} });

export const runOfficeConfigPass = async (
  context: RuntimeContext,
  state: BackfillMigrationState | null,
): Promise<void> => {
  let cursor =
    state?.stage === "OFFICE_CONFIGS" ? state.last_processed_facility_id : null;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection("warehouses")
      .where("type", "==", "OFFICE")
      .orderBy(FieldPath.documentId())
      .limit(context.options.batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const facilitySnapshot of snapshot.docs) {
      const facility = inputFrom(facilitySnapshot);
      const configSnapshot = await getOfficeScopeConfigRef(facility.id).get();
      const plan = planOfficeScopeConfig({
        facility,
        existingConfig: configSnapshot.exists
          ? inputFrom(configSnapshot)
          : null,
        initiatedBy: context.options.initiatedBy,
        now: new Date(),
      });
      recordIssues(context, plan.issues);
      context.report.processedFacilities += 1;
      const progress = {
        stage: "OFFICE_CONFIGS" as const,
        cursorField: "last_processed_facility_id" as const,
        cursorValue: facility.id,
        counterField: "processed_facility_count" as const,
        issues: plan.issues,
      };

      if (plan.config) {
        registerPlannedWrite(context);
        const committed = await commitCreateWithAudit({
          context,
          ref: getOfficeScopeConfigRef(facility.id),
          entityType: "office_scope_configs",
          entityId: facility.id,
          warehouseId: facility.id,
          patch: plan.config as unknown as Record<string, unknown>,
          progress,
        });
        registerCommittedWrite(context, committed);
      } else {
        await commitProgressOnly(context, progress);
      }
      cursor = facility.id;
    }

    await checkpointReport(context, {
      stage: "OFFICE_CONFIGS",
      last_processed_facility_id: cursor,
    });
  }

  await checkpointReport(context, {
    stage: "USERS",
    last_processed_facility_id: null,
    last_processed_user_id: null,
  });
};

export const runUserPass = async (
  context: RuntimeContext,
  state: BackfillMigrationState | null,
): Promise<void> => {
  let cursor = state?.stage === "USERS" ? state.last_processed_user_id : null;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection("users")
      .orderBy(FieldPath.documentId())
      .limit(context.options.batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const userSnapshot of snapshot.docs) {
      const user = inputFrom(userSnapshot);
      const profileSnapshot = await db
        .collection("employee_profiles")
        .where("user_id", "==", user.id)
        .get();
      const profiles = profileSnapshot.docs.map(inputFrom);
      const activeProfile = profiles.find(
        ({ data }) => data.is_deleted !== true && data.status === "ACTIVE",
      );
      const workplaceId =
        typeof activeProfile?.data.workplace_warehouse_id === "string"
          ? activeProfile.data.workplace_warehouse_id
          : null;
      const workplaceSnapshot = workplaceId
        ? await db.collection("warehouses").doc(workplaceId).get()
        : null;
      const plan = planUserBackfill({
        user,
        profiles,
        workplaceFacility:
          workplaceSnapshot?.exists && workplaceSnapshot
            ? inputFrom(workplaceSnapshot)
            : null,
        now: new Date(),
      });
      recordIssues(context, plan.issues);
      context.report.processedUsers += 1;
      const progress = {
        stage: "USERS" as const,
        cursorField: "last_processed_user_id" as const,
        cursorValue: user.id,
        counterField: "processed_user_count" as const,
        issues: plan.issues,
      };

      if (plan.patch) {
        registerPlannedWrite(context);
        try {
          const committed = await commitPatchWithAudit({
            context,
            ref: userSnapshot.ref,
            entityType: "users",
            entityId: user.id,
            warehouseId: plan.workplaceFacilityId,
            patch: plan.patch,
            expected: {
              workplace_facility_id: user.data.workplace_facility_id,
            },
            validateCurrentState: (transaction, currentUser) =>
              assertCurrentUserWorkplaceSource(
                transaction,
                currentUser,
                user.id,
                plan.workplaceFacilityId as string,
              ),
            progress,
          });
          registerCommittedWrite(context, committed);
        } catch (error) {
          if (!isBackfillPreconditionConflict(error)) throw error;
          recordIssues(context, [
            {
              code: "WORKPLACE_CONFLICT",
              entity_type: "users",
              entity_id: user.id,
              detail: error instanceof Error ? error.message : String(error),
            },
          ]);
          context.report.plannedEntityWrites -= 1;
          context.report.plannedAuditWrites -= 1;
          await commitProgressOnly(context, {
            ...progress,
            issues: [
              ...progress.issues,
              {
                code: "WORKPLACE_CONFLICT",
                entity_type: "users",
                entity_id: user.id,
                detail: error instanceof Error ? error.message : String(error),
              },
            ],
          });
        }
      } else {
        await commitProgressOnly(context, progress);
      }
      cursor = user.id;
    }

    await checkpointReport(context, {
      stage: "USERS",
      last_processed_user_id: cursor,
    });
  }

  await checkpointReport(context, {
    stage: "ASSIGNMENTS",
    last_processed_user_id: null,
    last_processed_assignment_id: null,
  });
};
