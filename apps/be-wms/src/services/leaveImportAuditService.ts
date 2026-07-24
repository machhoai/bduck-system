import {
  AuditAction,
  type LeaveImportBatch,
  type LeaveImportRow,
} from "@bduck/shared-types";
import type { LeaveImportRowCommitResult } from "../repositories/leaveImportCommitRepository.js";
import { logAudit } from "./auditService.js";

const asRecord = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;

export const auditLeaveImportPreview = async (input: {
  batch: LeaveImportBatch;
  rows: LeaveImportRow[];
  actor_id: string;
  action_time: Date;
}) => {
  await Promise.all([
    logAudit({
      entity_type: "leave_import_batches",
      entity_id: input.batch.id,
      action: AuditAction.CREATE,
      user_id: input.actor_id,
      old_value: null,
      new_value: asRecord(input.batch),
      action_time: input.action_time,
    }),
    ...input.rows.map((row) =>
      logAudit({
        entity_type: "leave_import_rows",
        entity_id: row.id,
        action: AuditAction.CREATE,
        user_id: input.actor_id,
        old_value: null,
        new_value: asRecord(row),
        action_time: input.action_time,
      }),
    ),
  ]);
};

export const auditLeaveImportRowCommit = async (input: {
  result: LeaveImportRowCommitResult;
  actor_id: string;
  action_time: Date;
}) => {
  const { result } = input;
  if (result.previous_row.committed_at) return;
  await Promise.all([
    logAudit({
      entity_type: "leave_import_rows",
      entity_id: result.row.id,
      action: AuditAction.UPDATE,
      user_id: input.actor_id,
      old_value: asRecord(result.previous_row),
      new_value: asRecord(result.row),
      action_time: input.action_time,
    }),
    result.bucket
      ? logAudit({
          entity_type: "leave_balance_buckets",
          entity_id: result.bucket.id,
          warehouse_id: result.bucket.workplace_warehouse_id,
          action: result.previous_bucket
            ? AuditAction.UPDATE
            : AuditAction.CREATE,
          user_id: input.actor_id,
          old_value: result.previous_bucket
            ? asRecord(result.previous_bucket)
            : null,
          new_value: asRecord(result.bucket),
          action_time: input.action_time,
        })
      : Promise.resolve(),
    result.ledger_entry
      ? logAudit({
          entity_type: "leave_ledger_entries",
          entity_id: result.ledger_entry.id,
          warehouse_id: result.ledger_entry.workplace_warehouse_id,
          action: AuditAction.CREATE,
          user_id: input.actor_id,
          old_value: null,
          new_value: asRecord(result.ledger_entry),
          action_time: input.action_time,
        })
      : Promise.resolve(),
    result.request
      ? logAudit({
          entity_type: "leave_requests",
          entity_id: result.request.id,
          warehouse_id: result.request.workplace_warehouse_id,
          action: AuditAction.CREATE,
          user_id: input.actor_id,
          old_value: null,
          new_value: asRecord(result.request),
          action_time: input.action_time,
        })
      : Promise.resolve(),
  ]);
};

export const auditLeaveImportBatchUpdate = async (input: {
  previous: LeaveImportBatch;
  batch: LeaveImportBatch;
  actor_id: string;
  action_time: Date;
}) => {
  await logAudit({
    entity_type: "leave_import_batches",
    entity_id: input.batch.id,
    action: AuditAction.UPDATE,
    user_id: input.actor_id,
    old_value: asRecord(input.previous),
    new_value: asRecord(input.batch),
    action_time: input.action_time,
  });
};
