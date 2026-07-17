import {
  AuditAction,
  OFFICE_SCOPE_CEILINGS_COLLECTION,
  type OfficeScopeCeilingConfig,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

const ceilingRef = (officeId: string) =>
  db.collection(OFFICE_SCOPE_CEILINGS_COLLECTION).doc(officeId);

const mapCeiling = (snapshot: FirebaseFirestore.DocumentSnapshot) =>
  mapFirestoreDocument<OfficeScopeCeilingConfig>(
    snapshot,
    ["created_at", "updated_at", "action_time", "sync_time"],
    [],
  );

export const getOfficeScopeCeiling = async (
  officeId: string,
): Promise<OfficeScopeCeilingConfig | null> => {
  const snapshot = await ceilingRef(officeId).get();
  return snapshot.exists ? mapCeiling(snapshot) : null;
};

export const applyOfficeScopeCeiling = async (
  config: OfficeScopeCeilingConfig,
  expectedRevision: number,
): Promise<void> => {
  await db.runTransaction(async (transaction) => {
    const ref = ceilingRef(config.office_id);
    const snapshot = await transaction.get(ref);
    const persistedRevision = snapshot.exists ? snapshot.get("revision") : 0;
    if (persistedRevision !== expectedRevision) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Trần phạm vi đã thay đổi ở phiên khác. Vui lòng tải dữ liệu mới.",
          zh: "范围上限已在其他会话中更改，请加载最新数据。",
        },
      };
    }
    transaction.set(ref, config, { merge: true });
    const auditId = `${config.office_id}_scope_ceiling_revision_${config.revision}`;
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: OFFICE_SCOPE_CEILINGS_COLLECTION,
      entity_id: config.office_id,
      warehouse_id: config.office_id,
      action: snapshot.exists ? AuditAction.UPDATE : AuditAction.CREATE,
      user_id: config.updated_by,
      user_name: null,
      entity_name: config.office_id,
      action_time: config.action_time,
      sync_time: config.sync_time,
      old_value: snapshot.exists ? snapshot.data() : null,
      new_value: config,
      ip_address: null,
      device_id: null,
      session_token: null,
      notes: "Update delegated Office scope management ceiling",
    });
  });
};
