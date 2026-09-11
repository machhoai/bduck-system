import { randomUUID } from "node:crypto";

import {
  AuditAction,
  MARKETING_VOUCHER_CAMPAIGNS_COLLECTION,
  POS_VOUCHER_CAMPAIGN_SETTINGS_COLLECTION,
  type PosVoucherCampaignOption,
  type PosVoucherCampaignSetting,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import type { AuditMetadata } from "../services/auditService.js";
import type { PosVoucherCampaignSettingValue } from "../services/posVoucherSettingsSchemas.js";

export const buildPosVoucherSettingId = (
  warehouseId: string,
  campaignId: string,
): string => `${warehouseId}__${campaignId}`;

const toDate = (value: unknown): Date =>
  value && typeof value === "object" && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date
      ? value
      : new Date(0);

const mapSetting = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): PosVoucherCampaignSetting => {
  const value = snapshot.data() as PosVoucherCampaignSetting;
  return {
    ...value,
    id: snapshot.id,
    created_at: toDate(value.created_at),
    updated_at: toDate(value.updated_at),
    action_time: toDate(value.action_time),
    sync_time: toDate(value.sync_time),
  };
};

export const posVoucherSettingsRepository = {
  async listCampaigns(): Promise<PosVoucherCampaignOption[]> {
    const snapshot = await db
      .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
      .where("is_deleted", "==", false)
      .get();
    return snapshot.docs
      .map((document) => {
        const value = document.data();
        return {
          id: document.id,
          name: String(value.name || document.id),
          reward_type: value.reward_type,
          reward_value: Number(value.reward_value) || 0,
          valid_from: value.valid_from,
          valid_to: value.valid_to,
          status: value.status,
        } as PosVoucherCampaignOption;
      })
      .filter((campaign) =>
        ["FREE_TICKET", "FREE_ITEM", "DISCOUNT_PERCENT"].includes(
          campaign.reward_type,
        ),
      )
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  },

  async listByWarehouse(
    warehouseId: string,
  ): Promise<PosVoucherCampaignSetting[]> {
    const snapshot = await db
      .collection(POS_VOUCHER_CAMPAIGN_SETTINGS_COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .get();
    return snapshot.docs
      .filter((document) => document.get("is_deleted") !== true)
      .map(mapSetting);
  },

  async save(input: {
    warehouseId: string;
    campaignId: string;
    actorId: string;
    value: PosVoucherCampaignSettingValue;
    context?: AuditMetadata;
  }): Promise<PosVoucherCampaignSetting> {
    const id = buildPosVoucherSettingId(input.warehouseId, input.campaignId);
    const reference = db
      .collection(POS_VOUCHER_CAMPAIGN_SETTINGS_COLLECTION)
      .doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists ? mapSetting(snapshot) : null;
      if ((previous?.version ?? 0) !== input.value.expected_version) {
        throw Object.assign(new Error("POS_VOUCHER_SETTING_VERSION_CONFLICT"), {
          statusCode: 409,
          messages: {
            vi: "Cấu hình voucher đã thay đổi. Vui lòng tải lại và thử lại.",
            zh: "优惠券设置已更改，请刷新后重试。",
          },
        });
      }
      const now = new Date();
      const current: PosVoucherCampaignSetting = {
        id,
        warehouse_id: input.warehouseId,
        campaign_id: input.campaignId,
        enabled: input.value.enabled,
        product_id: input.value.product_id,
        quantity: input.value.quantity,
        version: (previous?.version ?? 0) + 1,
        updated_by: input.actorId,
        is_deleted: false,
        created_at: previous?.created_at ?? now,
        updated_at: now,
        action_time: new Date(input.value.action_time),
        sync_time: now,
      };
      transaction.set(reference, current);
      const auditId = randomUUID();
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_VOUCHER_CAMPAIGN_SETTING",
        entity_id: id,
        entity_name: input.campaignId,
        warehouse_id: input.warehouseId,
        action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
        user_id: input.actorId,
        user_name: null,
        action_time: new Date(input.value.action_time),
        sync_time: now,
        old_value: previous,
        new_value: current,
        ip_address: input.context?.ip_address ?? null,
        device_id: input.context?.device_id ?? null,
        session_token: input.context?.session_token ?? null,
        notes: "Updated JPOS voucher campaign mapping",
      });
      return current;
    });
  },
};
