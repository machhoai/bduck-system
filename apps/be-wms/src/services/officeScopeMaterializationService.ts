import {
  AuditAction,
  OFFICE_SCOPE_EDGES_COLLECTION,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  claimOfficeScopeMaterializationRetry,
  createOfficeScopeMaterializationInTransaction,
  finalizeOfficeScopeMaterialization,
} from "../repositories/officeScopeMaterializationRepository.js";
import {
  applyOfficeScopeWritePlanInTransaction,
  type OfficeScopeWritePlan,
} from "../repositories/officeScopeRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanAdministerOfficeScope,
  assertExpectedOfficeScopeRevision,
} from "./officeScopeAdministrationPolicy.js";
import { assertOfficeFacility } from "./officeScopeServiceSupport.js";
import { rebuildUserAccessForUsers } from "./userAccessRebuildService.js";

export const retryOfficeScopeMaterialization = async (
  officeId: string,
  revision: number,
  actorId: string,
  authorization: AuthorizationService,
) => {
  await assertOfficeFacility(officeId);
  assertCanAdministerOfficeScope(authorization, officeId);
  const claimed = await claimOfficeScopeMaterializationRetry(
    officeId,
    revision,
    actorId,
  );
  if (claimed.userIds.length === 0) return claimed.status;
  const result = await rebuildUserAccessForUsers(
    claimed.userIds,
    "OFFICE_SCOPE_RETRY",
    actorId,
  );
  return finalizeOfficeScopeMaterialization(
    officeId,
    revision,
    claimed.userIds,
    result.failed,
  );
};

export const applyOfficeScopeChange = async (
  plan: OfficeScopeWritePlan,
): Promise<{ softDeletedEdgeIds: string[]; affectedUserIds: string[] }> => {
  const result = await db.runTransaction(async (transaction) => {
    const existingConfig = await transaction.get(plan.config.ref);
    const existingEdges = await transaction.get(
      db
        .collection(OFFICE_SCOPE_EDGES_COLLECTION)
        .where("office_id", "==", plan.config.data.office_id),
    );
    assertExpectedOfficeScopeRevision(
      plan.expectedRevision,
      existingConfig.exists ? existingConfig.get("revision") : 0,
    );
    const applied = await applyOfficeScopeWritePlanInTransaction(
      transaction,
      plan,
    );
    const config = plan.config.data;
    createOfficeScopeMaterializationInTransaction(transaction, {
      officeId: config.office_id,
      revision: config.revision,
      userIds: applied.affectedUserIds,
      requestedBy: config.updated_by,
      actionTime: config.action_time,
      syncTime: config.sync_time,
    });
    const auditId = `${config.office_id}_scope_revision_${config.revision}`;
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: "office_scope_configs",
      entity_id: config.office_id,
      warehouse_id: config.office_id,
      action: existingConfig.exists ? AuditAction.UPDATE : AuditAction.CREATE,
      user_id: config.updated_by,
      user_name: null,
      entity_name: config.office_id,
      action_time: config.action_time,
      sync_time: config.sync_time,
      old_value: existingConfig.exists
        ? {
            config: existingConfig.data(),
            target_facility_ids: existingEdges.docs
              .filter(
                (document) =>
                  document.get("is_active") === true &&
                  document.get("is_deleted") !== true,
              )
              .map((document) => document.get("target_facility_id"))
              .filter((value): value is string => typeof value === "string")
              .sort(),
          }
        : null,
      new_value: {
        config,
        target_facility_ids: plan.edges
          .map(({ data }) => data.target_facility_id)
          .sort(),
        affected_employee_count: applied.affectedUserIds.length,
      },
      ip_address: null,
      device_id: null,
      session_token: null,
      notes: "Update office managed facility scope",
    });
    return applied;
  });
  if (result.affectedUserIds.length > 0) {
    try {
      const rebuild = await rebuildUserAccessForUsers(
        result.affectedUserIds,
        "OFFICE_SCOPE_CHANGED",
        plan.config.data.updated_by,
        { enqueue: false },
      );
      await finalizeOfficeScopeMaterialization(
        plan.config.data.office_id,
        plan.config.data.revision,
        result.affectedUserIds,
        rebuild.failed,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OFFICE_SCOPE_REBUILD_FAILED";
      console.error("[officeScopeService] materialization failed:", error);
      await finalizeOfficeScopeMaterialization(
        plan.config.data.office_id,
        plan.config.data.revision,
        result.affectedUserIds,
        result.affectedUserIds.map((userId) => ({ userId, error: message })),
      );
    }
  }
  return result;
};
