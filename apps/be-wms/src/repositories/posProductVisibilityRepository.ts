import { randomUUID } from "crypto";

import {
  AuditAction,
  type PosProductVisibilityCatalogItem,
  type PosProductVisibilitySettings,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import type { AuditMetadata } from "../services/auditService.js";
import {
  buildPosProductGroupKey,
  isPosProductUpstreamVisible,
} from "../services/posProductVisibilityPolicy.js";
import type { PosProductVisibilitySettingsValue } from "../services/posProductVisibilitySchemas.js";

export const POS_PRODUCT_VISIBILITY_SETTINGS_COLLECTION =
  "pos_product_visibility_settings";
const JPOS_PRODUCTS_COLLECTION = "jpos_products";

export class PosProductVisibilityConflictError extends Error {
  readonly statusCode = 409;
  readonly messages = {
    vi: "Cấu hình sản phẩm đã được cập nhật ở nơi khác. Vui lòng tải phiên bản mới.",
    zh: "商品配置已在其他位置更新，请加载最新版本。",
  };

  constructor() {
    super("POS_PRODUCT_VISIBILITY_VERSION_CONFLICT");
  }
}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const toDate = (value: unknown): Date =>
  value && typeof value === "object" && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date
      ? value
      : new Date(0);

const mapSettings = (
  value: Record<string, unknown>,
): PosProductVisibilitySettings => ({
  ...(value as unknown as PosProductVisibilitySettings),
  disabled_group_keys: Array.isArray(value.disabled_group_keys)
    ? value.disabled_group_keys.filter((item): item is string => typeof item === "string")
    : [],
  disabled_product_ids: Array.isArray(value.disabled_product_ids)
    ? value.disabled_product_ids.filter((item): item is string => typeof item === "string")
    : [],
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
});

export const posProductVisibilityRepository = {
  async findByWarehouse(
    warehouseId: string,
  ): Promise<PosProductVisibilitySettings | null> {
    const snapshot = await db
      .collection(POS_PRODUCT_VISIBILITY_SETTINGS_COLLECTION)
      .doc(warehouseId)
      .get();
    return snapshot.exists ? mapSettings(snapshot.data() || {}) : null;
  },

  async listCatalog(): Promise<PosProductVisibilityCatalogItem[]> {
    const snapshot = await db.collection(JPOS_PRODUCTS_COLLECTION).get();
    return snapshot.docs
      .filter((document) => isPosProductUpstreamVisible(document.data()))
      .map((document) => {
        const value = document.data();
        return {
          goods_id: text(value.goodsId) || document.id,
          goods_name: text(value.goodsName) || text(value.name) || document.id,
          category: Number(value.category) || 0,
          group_key:
            text(value.groupKey) || buildPosProductGroupKey(value),
          group_name: text(value.typeName) || "Chưa phân nhóm",
          type_id: text(value.typeId) || null,
        };
      })
      .sort((left, right) =>
        left.goods_name.localeCompare(right.goods_name, "vi"),
      );
  },

  async save(input: {
    warehouseId: string;
    actorId: string;
    value: PosProductVisibilitySettingsValue;
    context?: AuditMetadata;
    source: "JPULSE" | "JPOS";
  }): Promise<PosProductVisibilitySettings> {
    const reference = db
      .collection(POS_PRODUCT_VISIBILITY_SETTINGS_COLLECTION)
      .doc(input.warehouseId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists
        ? mapSettings(snapshot.data() || {})
        : null;
      if ((previous?.version ?? 0) !== input.value.expected_version) {
        throw new PosProductVisibilityConflictError();
      }
      const now = new Date();
      const current: PosProductVisibilitySettings = {
        id: input.warehouseId,
        warehouse_id: input.warehouseId,
        version: (previous?.version ?? 0) + 1,
        disabled_group_keys: input.value.disabled_group_keys,
        disabled_product_ids: input.value.disabled_product_ids,
        updated_by: input.actorId,
        is_deleted: false,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };
      const auditId = randomUUID();
      transaction.set(reference, current);
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_PRODUCT_VISIBILITY_SETTINGS",
        entity_id: input.warehouseId,
        warehouse_id: input.warehouseId,
        action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
        user_id: input.actorId,
        user_name: null,
        entity_name: null,
        action_time: new Date(input.value.action_time),
        sync_time: now,
        old_value: previous,
        new_value: current,
        ip_address: input.context?.ip_address ?? null,
        device_id: input.context?.device_id ?? null,
        session_token: input.context?.session_token ?? null,
        notes: `Updated JPOS product visibility from ${input.source}`,
      });
      return current;
    });
  },
};

