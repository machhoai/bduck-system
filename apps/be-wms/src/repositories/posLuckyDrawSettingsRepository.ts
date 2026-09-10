import { randomUUID } from "crypto";

import {
  AuditAction,
  type PosLuckyDrawPackageOption,
  type PosLuckyDrawSettings,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import type { AuditMetadata } from "../services/auditService.js";
import type { PosLuckyDrawSettingsValue } from "../services/posLuckyDrawSettingsSchemas.js";

export const POS_LUCKY_DRAW_SETTINGS_COLLECTION = "pos_lucky_draw_settings";
const JPOS_PRODUCTS_COLLECTION = "jpos_products";
const MEMBER_PACKAGE_CATEGORIES = [1, 2, 6];

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const number = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const isoString = (value: unknown): string => {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date(0).toISOString();
};

const mapSettings = (
  warehouseId: string,
  value: Record<string, unknown>,
): PosLuckyDrawSettings => ({
  warehouseId,
  enabled: value.enabled === true,
  paperSize:
    value.paperSize === "POS58" || value.paperSize === "POS82"
      ? value.paperSize
      : "POS80",
  programName: text(value.programName),
  ticketTitle: text(value.ticketTitle),
  message: text(value.message),
  footerMessage: text(value.footerMessage),
  packageTicketCounts:
    value.packageTicketCounts &&
    typeof value.packageTicketCounts === "object" &&
    !Array.isArray(value.packageTicketCounts)
      ? Object.fromEntries(
          Object.entries(value.packageTicketCounts).flatMap(
            ([goodsId, ticketCount]) => {
              const normalized = number(ticketCount);
              return Number.isInteger(normalized) && normalized > 0
                ? [[goodsId, normalized]]
                : [];
            },
          ),
        )
      : {},
  version: number(value.version),
  updatedAt: isoString(value.updatedAt),
  updatedByUid: text(value.updatedByUid),
});

const mapPackage = (
  id: string,
  value: Record<string, unknown>,
): PosLuckyDrawPackageOption => ({
  goodsId: text(value.goodsId) || id,
  goodsName: text(value.goodsName) || text(value.name) || id,
  category: number(value.category),
  typeName: text(value.typeName),
  price: number(value.price),
  afterTaxPrice: number(value.afterTaxPrice),
});

export const posLuckyDrawSettingsRepository = {
  async findByWarehouse(
    warehouseId: string,
  ): Promise<PosLuckyDrawSettings | null> {
    const snapshot = await db
      .collection(POS_LUCKY_DRAW_SETTINGS_COLLECTION)
      .doc(warehouseId)
      .get();
    return snapshot.exists
      ? mapSettings(warehouseId, snapshot.data() || {})
      : null;
  },

  async listMemberPackages(): Promise<PosLuckyDrawPackageOption[]> {
    const snapshot = await db
      .collection(JPOS_PRODUCTS_COLLECTION)
      .where("category", "in", MEMBER_PACKAGE_CATEGORIES)
      .get();
    return snapshot.docs
      .filter((document) => {
        const value = document.data();
        return (
          value.isEnabled !== false &&
          value.isOpenSales !== false &&
          value.isCategoryEnabled !== false &&
          value.syncStatus !== "disabled"
        );
      })
      .map((document) => mapPackage(document.id, document.data()))
      .sort((left, right) =>
        left.goodsName.localeCompare(right.goodsName, "vi"),
      );
  },

  async save(input: {
    warehouseId: string;
    actorId: string;
    value: PosLuckyDrawSettingsValue;
    context?: AuditMetadata;
  }): Promise<PosLuckyDrawSettings> {
    const reference = db
      .collection(POS_LUCKY_DRAW_SETTINGS_COLLECTION)
      .doc(input.warehouseId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists
        ? mapSettings(input.warehouseId, snapshot.data() || {})
        : null;
      const now = new Date();
      const current: PosLuckyDrawSettings = {
        ...input.value,
        warehouseId: input.warehouseId,
        version: (previous?.version ?? 0) + 1,
        updatedAt: now.toISOString(),
        updatedByUid: input.actorId,
      };
      const auditId = randomUUID();
      transaction.set(reference, current);
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_LUCKY_DRAW_SETTINGS",
        entity_id: input.warehouseId,
        warehouse_id: input.warehouseId,
        action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
        user_id: input.actorId,
        user_name: null,
        entity_name: null,
        action_time: now,
        sync_time: now,
        old_value: previous,
        new_value: current,
        ip_address: input.context?.ip_address ?? null,
        device_id: input.context?.device_id ?? null,
        session_token: input.context?.session_token ?? null,
        notes: "Updated JPOS lucky draw settings from JPULSE",
      });
      return current;
    });
  },
};
