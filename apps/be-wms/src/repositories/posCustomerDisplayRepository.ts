import { randomUUID } from "crypto";

import {
  AuditAction,
  type PosCustomerDisplayMedia,
  type PosCustomerDisplayPlaylistItem,
  type PosCustomerDisplaySettings,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export const POS_CUSTOMER_DISPLAY_SETTINGS_COLLECTION = "pos_customer_display_settings";
const AUDIT_ENTITY_TYPE = "POS_CUSTOMER_DISPLAY_SETTINGS";

export class PosCustomerDisplayConflictError extends Error {
  readonly statusCode = 409;
  readonly messages = {
    vi: "Cấu hình quảng cáo đã được cập nhật ở nơi khác. Vui lòng xem lại phiên bản mới.",
    zh: "广告配置已在其他位置更新，请查看最新版本。",
  };

  constructor() {
    super("POS_CUSTOMER_DISPLAY_VERSION_CONFLICT");
    this.name = "PosCustomerDisplayConflictError";
  }
}

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
};

const mapSettings = (value: Record<string, unknown>): PosCustomerDisplaySettings => ({
  ...(value as unknown as PosCustomerDisplaySettings),
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
});

const mapMedia = (value: Record<string, unknown>): PosCustomerDisplayMedia => ({
  ...(value as unknown as PosCustomerDisplayMedia),
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
});

const settingsRef = (warehouseId: string) =>
  db.collection(POS_CUSTOMER_DISPLAY_SETTINGS_COLLECTION).doc(warehouseId);

const mediaRef = (warehouseId: string, mediaId: string) =>
  settingsRef(warehouseId).collection("media").doc(mediaId);

const assertVersion = (settings: PosCustomerDisplaySettings | null, expectedVersion: number) => {
  if ((settings?.version ?? 0) !== expectedVersion) throw new PosCustomerDisplayConflictError();
};

const nextSettings = (input: {
  warehouseId: string;
  actorId: string;
  previous: PosCustomerDisplaySettings | null;
  playlist: PosCustomerDisplayPlaylistItem[];
  now: Date;
}): PosCustomerDisplaySettings => ({
  id: input.warehouseId,
  warehouse_id: input.warehouseId,
  version: (input.previous?.version ?? 0) + 1,
  playlist: input.playlist.map((item, index) => ({ ...item, sort_order: index })),
  updated_by: input.actorId,
  is_deleted: false,
  created_at: input.previous?.created_at ?? input.now,
  updated_at: input.now,
});

const writeAudit = (input: {
  transaction: FirebaseFirestore.Transaction;
  warehouseId: string;
  actorId: string;
  actionTime: Date;
  syncTime: Date;
  previous: unknown;
  current: unknown;
  context?: { ip_address?: string | null; device_id?: string | null; session_token?: string | null };
  source: "JPULSE" | "JPOS";
}) => {
  const auditId = randomUUID();
  input.transaction.create(db.collection("audit_logs").doc(auditId), {
    id: auditId,
    entity_type: AUDIT_ENTITY_TYPE,
    entity_id: input.warehouseId,
    warehouse_id: input.warehouseId,
    action: input.previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: input.actorId,
    user_name: null,
    entity_name: null,
    action_time: input.actionTime,
    sync_time: input.syncTime,
    old_value: input.previous,
    new_value: input.current,
    ip_address: input.context?.ip_address ?? null,
    device_id: input.context?.device_id ?? null,
    session_token: input.context?.session_token ?? null,
    notes: `Updated customer display advertising from ${input.source}`,
  });
};

export const posCustomerDisplayRepository = {
  async findSettings(warehouseId: string): Promise<PosCustomerDisplaySettings | null> {
    const snapshot = await settingsRef(warehouseId).get();
    return snapshot.exists ? mapSettings(snapshot.data() || {}) : null;
  },

  async findMediaByIds(warehouseId: string, mediaIds: string[]): Promise<PosCustomerDisplayMedia[]> {
    if (mediaIds.length === 0) return [];
    const snapshots = await db.getAll(...mediaIds.map((id) => mediaRef(warehouseId, id)));
    return snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => mapMedia(snapshot.data() || {}));
  },

  async createMedia(input: {
    warehouseId: string;
    actorId: string;
    expectedVersion: number;
    media: PosCustomerDisplayMedia;
    actionTime: Date;
    context?: { ip_address?: string | null; device_id?: string | null; session_token?: string | null };
    source: "JPULSE" | "JPOS";
  }): Promise<PosCustomerDisplaySettings> {
    return db.runTransaction(async (transaction) => {
      const configReference = settingsRef(input.warehouseId);
      const assetReference = mediaRef(input.warehouseId, input.media.id);
      const [configSnapshot, assetSnapshot] = await transaction.getAll(configReference, assetReference);
      const previous = configSnapshot.exists ? mapSettings(configSnapshot.data() || {}) : null;
      assertVersion(previous, input.expectedVersion);
      if (assetSnapshot.exists) throw new PosCustomerDisplayConflictError();
      if ((previous?.playlist.length ?? 0) >= 10) {
        throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_LIMIT"), {
          statusCode: 400,
          messages: { vi: "Mỗi cửa hàng chỉ được cấu hình tối đa 10 quảng cáo.", zh: "每个门店最多可配置 10 个广告。" },
        });
      }
      const now = new Date();
      const playlist = [
        ...(previous?.playlist ?? []),
        {
          media_id: input.media.id,
          sort_order: previous?.playlist.length ?? 0,
          enabled: true,
          image_duration_seconds: input.media.type === "IMAGE" ? 7 : null,
        },
      ];
      const current = nextSettings({ warehouseId: input.warehouseId, actorId: input.actorId, previous, playlist, now });
      transaction.create(assetReference, input.media);
      transaction.set(configReference, current);
      writeAudit({ transaction, warehouseId: input.warehouseId, actorId: input.actorId, actionTime: input.actionTime, syncTime: now, previous, current: { settings: current, media: input.media }, context: input.context, source: input.source });
      return current;
    });
  },

  async savePlaylist(input: {
    warehouseId: string;
    actorId: string;
    expectedVersion: number;
    playlist: PosCustomerDisplayPlaylistItem[];
    actionTime: Date;
    context?: { ip_address?: string | null; device_id?: string | null; session_token?: string | null };
    source: "JPULSE" | "JPOS";
  }): Promise<PosCustomerDisplaySettings> {
    return db.runTransaction(async (transaction) => {
      const configReference = settingsRef(input.warehouseId);
      const configSnapshot = await transaction.get(configReference);
      const previous = configSnapshot.exists ? mapSettings(configSnapshot.data() || {}) : null;
      assertVersion(previous, input.expectedVersion);
      const assetSnapshots = input.playlist.length > 0
        ? await transaction.getAll(...input.playlist.map((item) => mediaRef(input.warehouseId, item.media_id)))
        : [];
      if (assetSnapshots.some((snapshot) => !snapshot.exists || mapMedia(snapshot.data() || {}).is_deleted)) {
        throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_MEDIA_NOT_FOUND"), {
          statusCode: 400,
          messages: { vi: "Playlist chứa tệp quảng cáo không còn khả dụng.", zh: "播放列表包含不可用的广告文件。" },
        });
      }
      const mediaById = new Map(
        assetSnapshots.map((snapshot) => {
          const media = mapMedia(snapshot.data() || {});
          return [media.id, media] as const;
        }),
      );
      const hasInvalidDuration = input.playlist.some((item) => {
        const media = mediaById.get(item.media_id);
        return media?.type === "VIDEO"
          ? item.image_duration_seconds !== null
          : item.image_duration_seconds === null;
      });
      if (hasInvalidDuration) {
        throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_DURATION_INVALID"), {
          statusCode: 400,
          messages: {
            vi: "Thời lượng chỉ áp dụng cho hình ảnh; video tự chuyển khi phát xong.",
            zh: "时长仅适用于图片；视频播放结束后自动切换。",
          },
        });
      }
      const now = new Date();
      const current = nextSettings({ warehouseId: input.warehouseId, actorId: input.actorId, previous, playlist: input.playlist, now });
      transaction.set(configReference, current);
      writeAudit({ transaction, warehouseId: input.warehouseId, actorId: input.actorId, actionTime: input.actionTime, syncTime: now, previous, current, context: input.context, source: input.source });
      return current;
    });
  },

  async softDeleteMedia(input: {
    warehouseId: string;
    mediaId: string;
    actorId: string;
    expectedVersion: number;
    actionTime: Date;
    context?: { ip_address?: string | null; device_id?: string | null; session_token?: string | null };
    source: "JPULSE" | "JPOS";
  }): Promise<PosCustomerDisplaySettings> {
    return db.runTransaction(async (transaction) => {
      const configReference = settingsRef(input.warehouseId);
      const assetReference = mediaRef(input.warehouseId, input.mediaId);
      const [configSnapshot, assetSnapshot] = await transaction.getAll(configReference, assetReference);
      const previous = configSnapshot.exists ? mapSettings(configSnapshot.data() || {}) : null;
      assertVersion(previous, input.expectedVersion);
      if (!assetSnapshot.exists) {
        throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_MEDIA_NOT_FOUND"), {
          statusCode: 404,
          messages: { vi: "Không tìm thấy tệp quảng cáo.", zh: "未找到广告文件。" },
        });
      }
      const previousMedia = mapMedia(assetSnapshot.data() || {});
      const now = new Date();
      const currentMedia = { ...previousMedia, is_deleted: true, updated_by: input.actorId, updated_at: now };
      const current = nextSettings({ warehouseId: input.warehouseId, actorId: input.actorId, previous, playlist: (previous?.playlist ?? []).filter((item) => item.media_id !== input.mediaId), now });
      transaction.set(assetReference, currentMedia);
      transaction.set(configReference, current);
      writeAudit({ transaction, warehouseId: input.warehouseId, actorId: input.actorId, actionTime: input.actionTime, syncTime: now, previous: { settings: previous, media: previousMedia }, current: { settings: current, media: currentMedia }, context: input.context, source: input.source });
      return current;
    });
  },
};
