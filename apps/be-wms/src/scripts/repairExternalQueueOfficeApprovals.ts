import {
  AuditAction,
  type ApprovalRecord,
  type ProcessConfig,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { runWithLocalFirebaseTarget } from "../config/firebaseTargetContext.js";
import { logAudit } from "../services/auditService.js";
import { notifyInitialApprovalTasks } from "../services/workflowNotificationService.js";

const TARGET_PROJECT = "jw-system-f2104";
const CONFIG_ENTITY = "EXTERNAL_QUEUE_EXPORT";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const REPAIR_ACTOR = "SYSTEM_EXTERNAL_QUEUE_OFFICE_SCOPE_REPAIR";

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

const valueFor = (prefix: string): string | null => {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
};

const businessDate = (value: unknown): string | null => {
  const date = toDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const requestedDate =
  valueFor("--date=") ??
  businessDate(new Date()) ??
  new Date().toISOString().slice(0, 10);
const shouldApply = hasFlag("--apply");

interface RepairTarget {
  entityId: string;
  warehouseId: string;
  approvalAttempt: number;
  pendingRecords: ApprovalRecord[];
}

async function findRepairTargets(): Promise<RepairTarget[]> {
  const pendingSnapshot = await db
    .collection("pending_approvals")
    .where("config_entity_type", "==", CONFIG_ENTITY)
    .where("status", "==", "PENDING")
    .get();
  const pending = pendingSnapshot.docs.map(
    (document) => ({ id: document.id, ...document.data() }) as ApprovalRecord,
  );
  const entityIds = Array.from(
    new Set(
      pending
        .filter((record) => record.approval_scope === "GLOBAL")
        .map((record) => record.entity_id),
    ),
  );
  const targets: RepairTarget[] = [];

  for (const entityId of entityIds) {
    const records = pending.filter((record) => record.entity_id === entityId);
    const approvalAttempt = Math.max(
      ...records.map((record) => record.approval_attempt ?? 1),
    );
    const currentAttempt = records.filter(
      (record) => (record.approval_attempt ?? 1) === approvalAttempt,
    );
    if (!currentAttempt.some((record) => record.approval_scope === "GLOBAL")) {
      continue;
    }

    const queueSnapshot = await db
      .collection("external_scan_queue")
      .where("export_voucher_id", "==", entityId)
      .get();
    const queueRecords = queueSnapshot.docs
      .map((document) => document.data())
      .filter(
        (record) =>
          record.is_deleted === false &&
          record.status === "PENDING_EXPORT_APPROVAL",
      );
    if (
      queueRecords.length === 0 ||
      !queueRecords.some(
        (record) => businessDate(record.approved_at) === requestedDate,
      )
    ) {
      continue;
    }

    const warehouseId = currentAttempt[0]?.warehouse_id;
    if (
      !warehouseId ||
      currentAttempt.some((record) => record.warehouse_id !== warehouseId)
    ) {
      throw new Error(`Invalid approval warehouse for ${entityId}`);
    }
    targets.push({
      entityId,
      warehouseId,
      approvalAttempt,
      pendingRecords: currentAttempt,
    });
  }

  return targets;
}

async function loadConfigs(): Promise<ProcessConfig[]> {
  const snapshot = await db
    .collection("process_configs")
    .where("entity_type", "==", CONFIG_ENTITY)
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs.map(
    (document) => ({ id: document.id, ...document.data() }) as ProcessConfig,
  );
}

async function run(): Promise<void> {
  if ((db as unknown as { projectId: string }).projectId !== TARGET_PROJECT) {
    throw new Error(
      `Refusing to repair project ${(db as unknown as { projectId: string }).projectId}`,
    );
  }

  const [configs, targets] = await Promise.all([
    loadConfigs(),
    findRepairTargets(),
  ]);
  const configUpdates = configs.flatMap((config) => {
    const nextChain = config.approval_chain.map((level) =>
      level.level > 0 && (level.required || level.enabled)
        ? {
            ...level,
            approval_scope: "ENTITY_WAREHOUSE" as const,
            allow_global_fallback: false,
          }
        : level,
    );
    return JSON.stringify(nextChain) === JSON.stringify(config.approval_chain)
      ? []
      : [{ config, nextChain }];
  });

  console.log(
    JSON.stringify(
      {
        project_id: TARGET_PROJECT,
        mode: shouldApply ? "APPLY" : "DRY_RUN",
        business_date: requestedDate,
        config_updates: configUpdates.map(({ config }) => config.id),
        approval_repairs: targets.map((target) => ({
          entity_id: target.entityId,
          warehouse_id: target.warehouseId,
          approval_attempt: target.approvalAttempt,
          pending_levels: target.pendingRecords.map(
            (record) => record.level + 1,
          ),
        })),
      },
      null,
      2,
    ),
  );

  if (!shouldApply) return;
  if (configUpdates.length === 0 && targets.length === 0) {
    console.log("No repair was required.");
    return;
  }

  const now = new Date();
  const batch = db.batch();
  configUpdates.forEach(({ config, nextChain }) => {
    batch.update(db.collection("process_configs").doc(config.id), {
      approval_chain: nextChain,
      updated_at: now,
    });
  });
  targets.forEach((target) => {
    target.pendingRecords.forEach((record) => {
      batch.update(db.collection("pending_approvals").doc(record.id), {
        approval_scope: "ENTITY_WAREHOUSE",
        approval_warehouse_id: target.warehouseId,
        allow_global_fallback: false,
        action_time: now,
        sync_time: now,
      });
    });
  });
  await batch.commit();

  for (const { config, nextChain } of configUpdates) {
    await logAudit({
      entity_type: "PROCESS_CONFIG",
      entity_id: config.id,
      warehouse_id: config.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: REPAIR_ACTOR,
      old_value: { approval_chain: config.approval_chain },
      new_value: { approval_chain: nextChain },
      notes:
        "Changed external queue approval levels to entity warehouse scope for Office-inherited roles.",
    });
  }

  for (const target of targets) {
    const repairedRecords = target.pendingRecords.map((record) => ({
      ...record,
      approval_scope: "ENTITY_WAREHOUSE" as const,
      approval_warehouse_id: target.warehouseId,
      allow_global_fallback: false,
      action_time: now,
      sync_time: now,
    }));
    await logAudit({
      entity_type: "EXPORT_VOUCHER",
      entity_id: target.entityId,
      warehouse_id: target.warehouseId,
      action: AuditAction.UPDATE,
      user_id: REPAIR_ACTOR,
      old_value: {
        approval_attempt: target.approvalAttempt,
        pending_approval_scopes: target.pendingRecords.map((record) => ({
          approval_id: record.id,
          level: record.level,
          approval_scope: record.approval_scope,
          approval_warehouse_id: record.approval_warehouse_id,
        })),
      },
      new_value: {
        approval_attempt: target.approvalAttempt,
        pending_approval_scopes: repairedRecords.map((record) => ({
          approval_id: record.id,
          level: record.level,
          approval_scope: record.approval_scope,
          approval_warehouse_id: record.approval_warehouse_id,
        })),
      },
      notes:
        "Repaired today's external queue approval so JJLand Office approvers can continue without recreating the voucher.",
    });
    await notifyInitialApprovalTasks(repairedRecords);
  }

  console.log(
    `Applied ${configUpdates.length} config update(s) and ${targets.length} approval repair(s).`,
  );
}

void runWithLocalFirebaseTarget("jw-system-f2104", async () => {
  try {
    await run();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
