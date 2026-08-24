import { createHash } from "node:crypto";

import {
  MARKETING_VOUCHER_CAMPAIGNS_COLLECTION,
  MARKETING_VOUCHER_CODES_COLLECTION,
  MARKETING_VOUCHER_JOBS_COLLECTION,
  type AuditAction,
  type LocalizedText,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
  type MarketingVoucherJob,
  type MarketingVoucherJobItem,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

export const MARKETING_VOUCHER_OPERATIONS_COLLECTION =
  "marketing_voucher_operations";

export interface MarketingVoucherAuditMetadata {
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
}

export interface MarketingVoucherOperationContext extends MarketingVoucherAuditMetadata {
  actor_id: string;
  action_time: Date;
  idempotency_key: string;
}

export interface PreparedMarketingVoucherOperation {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  request_hash: string;
  replay: Record<string, unknown> | null;
}

export const marketingVoucherError = (
  code: string,
  messages: LocalizedText,
  statusCode = 409,
  data?: unknown,
) => ({ code, messages, statusCode, data });

export const campaignRef = (campaignId: string) =>
  db.collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION).doc(campaignId);
export const codeRef = (codeId: string) =>
  db.collection(MARKETING_VOUCHER_CODES_COLLECTION).doc(codeId);
export const jobRef = (jobId: string) =>
  db.collection(MARKETING_VOUCHER_JOBS_COLLECTION).doc(jobId);
export const jobItemRef = (jobId: string, itemId: string) =>
  jobRef(jobId).collection("items").doc(itemId);

const mapSnapshot = <T>(
  snapshot: FirebaseFirestore.DocumentSnapshot,
  nullableDates: string[],
): T =>
  mapFirestoreDocument<T>(
    snapshot,
    ["created_at", "updated_at", "action_time", "sync_time"],
    nullableDates,
  );

export const mapMarketingVoucherCampaign = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MarketingVoucherCampaign => mapSnapshot(snapshot, []);

export const mapMarketingVoucherCode = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MarketingVoucherCode =>
  mapSnapshot(snapshot, [
    "distributed_at",
    "used_at",
    "emailed_at",
    "revoked_at",
  ]);

export const mapMarketingVoucherJob = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MarketingVoucherJob => mapSnapshot(snapshot, ["completed_at"]);

export const mapMarketingVoucherJobItem = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MarketingVoucherJobItem => mapSnapshot(snapshot, ["completed_at"]);

const stableValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
};

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const prepareMarketingVoucherOperation = async (
  transaction: FirebaseFirestore.Transaction,
  action: string,
  context: MarketingVoucherOperationContext,
  request: unknown,
): Promise<PreparedMarketingVoucherOperation> => {
  const id = sha256(`${context.actor_id}:${action}:${context.idempotency_key}`);
  const ref = db.collection(MARKETING_VOUCHER_OPERATIONS_COLLECTION).doc(id);
  const requestHash = sha256(JSON.stringify(stableValue(request)));
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists) {
    return { id, ref, request_hash: requestHash, replay: null };
  }
  if (snapshot.get("request_hash") !== requestHash) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_IDEMPOTENCY_CONFLICT",
      {
        vi: "Khóa chống trùng đã được dùng cho yêu cầu khác.",
        zh: "幂等键已用于其他请求。",
      },
      409,
    );
  }
  const result = snapshot.get("result");
  if (!result || typeof result !== "object") {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_OPERATION_CORRUPTED",
      {
        vi: "Không thể đọc kết quả thao tác voucher trước đó.",
        zh: "无法读取先前的优惠券操作结果。",
      },
      500,
    );
  }
  return { id, ref, request_hash: requestHash, replay: result };
};

export const writeMarketingVoucherOperation = (
  transaction: FirebaseFirestore.Transaction,
  prepared: PreparedMarketingVoucherOperation,
  action: string,
  context: MarketingVoucherOperationContext,
  result: Record<string, unknown>,
  syncTime: Date,
) => {
  transaction.create(prepared.ref, {
    id: prepared.id,
    action,
    actor_id: context.actor_id,
    idempotency_key: context.idempotency_key,
    request_hash: prepared.request_hash,
    result,
    action_time: context.action_time,
    sync_time: syncTime,
    created_at: syncTime,
  });
};

export const writeMarketingVoucherAudit = (
  transaction: FirebaseFirestore.Transaction,
  input: {
    id: string;
    action: AuditAction;
    entity_type: string;
    entity_id: string;
    entity_name: string | null;
    context: MarketingVoucherOperationContext;
    old_value: unknown;
    new_value: unknown;
    sync_time: Date;
    notes: string;
  },
) => {
  transaction.create(db.collection("audit_logs").doc(input.id), {
    id: input.id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    warehouse_id: null,
    action: input.action,
    user_id: input.context.actor_id,
    user_name: null,
    entity_name: input.entity_name,
    action_time: input.context.action_time,
    sync_time: input.sync_time,
    old_value: input.old_value,
    new_value: input.new_value,
    ip_address: input.context.ip_address ?? null,
    device_id: input.context.device_id ?? null,
    session_token: input.context.session_token
      ? sha256(input.context.session_token)
      : null,
    notes: input.notes,
  });
};
