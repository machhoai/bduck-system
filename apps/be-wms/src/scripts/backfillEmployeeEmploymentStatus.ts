import { AuditAction, EmployeeEmploymentStatus } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import {
  planEmployeeEmploymentStatusBackfill,
  type LegacyEmployeeProfileRecord,
} from "./employeeEmploymentBackfillPlanner.js";

const APPLY_FLAG = "--apply";
// Two writes per employee: profile projection + immutable audit record.
const BATCH_SIZE = 200;
const actorId = "system:migration:employee-employment-status";

const run = async () => {
  const apply = process.argv.includes(APPLY_FLAG);
  const snapshot = await db
    .collection("employee_profiles")
    .where("is_deleted", "==", false)
    .get();
  const records: LegacyEmployeeProfileRecord[] = snapshot.docs.map(
    (document) => ({
      id: document.id,
      ...document.data(),
    }),
  );
  const plan = planEmployeeEmploymentStatusBackfill(records);
  const recordById = new Map(records.map((record) => [record.id, record]));
  const candidates = plan.map((item) => {
    const record = recordById.get(item.id);
    return {
      id: item.id,
      employee_code: record?.employee_code ?? null,
      full_name: record?.full_name ?? null,
      workplace_warehouse_id: record?.workplace_warehouse_id ?? null,
      patch: item.patch,
    };
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLY" : "DRY_RUN",
        scanned: records.length,
        updates: plan.length,
        default_status: EmployeeEmploymentStatus.UNSPECIFIED,
        candidates,
      },
      null,
      2,
    ),
  );
  if (!apply || plan.length === 0) return;

  for (let offset = 0; offset < plan.length; offset += BATCH_SIZE) {
    const now = new Date();
    const batch = db.batch();
    for (const item of plan.slice(offset, offset + BATCH_SIZE)) {
      const oldValue = recordById.get(item.id);
      const newValue = {
        ...oldValue,
        ...item.patch,
        updated_at: now,
      };
      batch.update(db.collection("employee_profiles").doc(item.id), {
        ...item.patch,
        updated_at: now,
      });
      const auditRef = db.collection("audit_logs").doc(randomUUID());
      batch.set(auditRef, {
        id: auditRef.id,
        entity_type: "employee_profiles",
        entity_id: item.id,
        warehouse_id: oldValue?.workplace_warehouse_id ?? null,
        action: AuditAction.UPDATE,
        user_id: actorId,
        user_name: "System",
        entity_name:
          typeof oldValue?.full_name === "string"
            ? oldValue.full_name
            : typeof oldValue?.employee_code === "string"
              ? oldValue.employee_code
              : null,
        action_time: now,
        sync_time: now,
        old_value: oldValue,
        new_value: newValue,
        ip_address: null,
        device_id: null,
        session_token: null,
        notes: "Phase 7 employment profile schema backfill",
      });
    }
    await batch.commit();
    console.log(
      `Applied ${Math.min(offset + BATCH_SIZE, plan.length)}/${plan.length}`,
    );
  }
};

run().catch((error) => {
  console.error("[backfillEmployeeEmploymentStatus] failed", error);
  process.exitCode = 1;
});
