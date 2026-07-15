import { FieldPath } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import {
  planLegacyAssignment,
  type DocumentInput,
} from "./facilityAccessBackfillPlanner.js";
import {
  checkpointReport,
  recordIssues,
  registerCommittedWrite,
  registerPlannedWrite,
} from "./facilityAccessBackfillPassUtils.js";
import {
  commitPatchWithAudit,
  commitProgressOnly,
} from "./facilityAccessBackfillWrites.js";
import type {
  BackfillMigrationState,
  RuntimeContext,
} from "./facilityAccessBackfillTypes.js";

const inputFrom = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): DocumentInput => ({ id: snapshot.id, data: snapshot.data() ?? {} });

export const runAssignmentPass = async (
  context: RuntimeContext,
  state: BackfillMigrationState | null,
): Promise<void> => {
  let cursor =
    state?.stage === "ASSIGNMENTS" ? state.last_processed_assignment_id : null;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection("user_warehouse_roles")
      .orderBy(FieldPath.documentId())
      .limit(context.options.batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const assignmentSnapshot of snapshot.docs) {
      const assignment = inputFrom(assignmentSnapshot);
      const userId =
        typeof assignment.data.user_id === "string"
          ? assignment.data.user_id
          : "";
      const userSnapshot = userId
        ? await db.collection("users").doc(userId).get()
        : null;
      context.report.processedAssignments += 1;
      const baseProgress = {
        stage: "ASSIGNMENTS" as const,
        cursorField: "last_processed_assignment_id" as const,
        cursorValue: assignment.id,
        counterField: "processed_assignment_count" as const,
      };

      if (!userSnapshot?.exists) {
        const issues = [
          {
            code: "ORPHAN_ASSIGNMENT_USER_NOT_FOUND" as const,
            entity_type: "user_warehouse_roles",
            entity_id: assignment.id,
            detail: `Assignment references missing user ${userId || "<empty>"}.`,
          },
        ];
        recordIssues(context, issues);
        await commitProgressOnly(context, { ...baseProgress, issues });
        cursor = assignment.id;
        continue;
      }

      const plan = planLegacyAssignment(assignment, new Date());
      recordIssues(context, plan.issues);
      const progress = { ...baseProgress, issues: plan.issues };
      if (plan.patch) {
        registerPlannedWrite(context);
        const warehouseId =
          typeof assignment.data.warehouse_id === "string"
            ? assignment.data.warehouse_id
            : null;
        const committed = await commitPatchWithAudit({
          context,
          ref: assignmentSnapshot.ref,
          entityType: "user_warehouse_roles",
          entityId: assignment.id,
          warehouseId,
          patch: plan.patch,
          expected: { scope_origin: assignment.data.scope_origin },
          progress,
        });
        registerCommittedWrite(context, committed);
      } else {
        await commitProgressOnly(context, progress);
      }
      cursor = assignment.id;
    }

    await checkpointReport(context, {
      stage: "ASSIGNMENTS",
      last_processed_assignment_id: cursor,
    });
  }

  await checkpointReport(context, {
    stage: "PROFILE_DIAGNOSTICS",
    last_processed_assignment_id: null,
    last_scanned_profile_id: null,
  });
};

export const runProfileDiagnosticsPass = async (
  context: RuntimeContext,
  state: BackfillMigrationState | null,
): Promise<void> => {
  let cursor =
    state?.stage === "PROFILE_DIAGNOSTICS"
      ? state.last_scanned_profile_id
      : null;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection("employee_profiles")
      .orderBy(FieldPath.documentId())
      .limit(context.options.batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const profileSnapshot of snapshot.docs) {
      const profile = inputFrom(profileSnapshot);
      const userId =
        typeof profile.data.user_id === "string" ? profile.data.user_id : "";
      context.report.scannedProfiles += 1;
      const issues = [] as Array<{
        code:
          | "ORPHAN_PROFILE_NO_USER_ID"
          | "ORPHAN_PROFILE_USER_NOT_FOUND"
          | "ORPHAN_PROFILE_USER_DELETED";
        entity_type: string;
        entity_id: string;
        detail: string;
      }>;

      if (!userId) {
        issues.push(
          {
            code: "ORPHAN_PROFILE_NO_USER_ID",
            entity_type: "employee_profiles",
            entity_id: profile.id,
            detail: "Profile is not linked to a user.",
          },
        );
      } else {
        const userSnapshot = await db.collection("users").doc(userId).get();
        if (!userSnapshot.exists) {
          issues.push(
            {
              code: "ORPHAN_PROFILE_USER_NOT_FOUND",
              entity_type: "employee_profiles",
              entity_id: profile.id,
              detail: `Profile references missing user ${userId}.`,
            },
          );
        } else if (userSnapshot.data()?.is_deleted === true) {
          issues.push(
            {
              code: "ORPHAN_PROFILE_USER_DELETED",
              entity_type: "employee_profiles",
              entity_id: profile.id,
              detail: `Profile references soft-deleted user ${userId}.`,
            },
          );
        }
      }
      recordIssues(context, issues);
      await commitProgressOnly(context, {
        stage: "PROFILE_DIAGNOSTICS",
        cursorField: "last_scanned_profile_id",
        cursorValue: profile.id,
        counterField: "scanned_profile_count",
        issues,
      });
      cursor = profile.id;
    }

    await checkpointReport(context, {
      stage: "PROFILE_DIAGNOSTICS",
      last_scanned_profile_id: cursor,
    });
  }
};
