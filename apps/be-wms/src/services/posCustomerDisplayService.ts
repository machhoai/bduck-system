import { randomUUID } from "crypto";

import type {
  PosCustomerDisplayMedia,
  PosCustomerDisplaySettingsInput,
  PosCustomerDisplaySettingsView,
} from "@bduck/shared-types";

import { storage } from "../config/firebase.js";
import { posCustomerDisplayRepository } from "../repositories/posCustomerDisplayRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  inspectCustomerDisplayMedia,
  sanitizeCustomerDisplayFileName,
} from "./posCustomerDisplayMediaValidation.js";
import { loadWarehouseById } from "./warehouseService.js";

const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

const parseActionTime = (value: string): Date => {
  const actionTime = new Date(value);
  const skew = Math.abs(Date.now() - actionTime.getTime());
  if (!Number.isFinite(actionTime.getTime()) || skew > 24 * 60 * 60 * 1000) {
    return new Date();
  }
  return actionTime;
};

const createReadUrl = async (storagePath: string): Promise<string> => {
  const [url] = await storage.bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return url;
};

export const getPosCustomerDisplaySettingsView = async (
  warehouseId: string,
  downloadMode: "SIGNED" | "DEVICE" = "SIGNED",
): Promise<PosCustomerDisplaySettingsView> => {
  const settings = await posCustomerDisplayRepository.findSettings(warehouseId);
  const mediaIds = settings?.playlist.map((item) => item.media_id) ?? [];
  const media = await posCustomerDisplayRepository.findMediaByIds(warehouseId, mediaIds);
  const activeMedia = media.filter((item) => !item.is_deleted);
  const mediaViews = await Promise.all(
    activeMedia.map(async (item) => ({
      ...item,
      download_url:
        downloadMode === "DEVICE"
          ? `/api/pos/devices/customer-display-media/${item.id}/content`
          : await createReadUrl(item.storage_path),
    })),
  );
  return { settings, media: mediaViews };
};

export const getPosCustomerDisplayMediaContent = async (
  warehouseId: string,
  mediaId: string,
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> => {
  const [media] = await posCustomerDisplayRepository.findMediaByIds(warehouseId, [mediaId]);
  if (!media || media.is_deleted) {
    throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_MEDIA_NOT_FOUND"), {
      statusCode: 404,
      messages: { vi: "Không tìm thấy tệp quảng cáo.", zh: "未找到广告文件。" },
    });
  }
  const [buffer] = await storage.bucket().file(media.storage_path).download();
  return { buffer, contentType: media.mime_type, fileName: media.file_name };
};

export const getPosCustomerDisplaySettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosCustomerDisplaySettingsView> => {
  authorization.assert("pos.advertising.read", warehouseId);
  await loadWarehouseById(warehouseId);
  return getPosCustomerDisplaySettingsView(warehouseId);
};

export const savePosCustomerDisplaySettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosCustomerDisplaySettingsInput;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
  source: "JPULSE" | "JPOS";
}): Promise<PosCustomerDisplaySettingsView> => {
  input.authorization.assert("pos.advertising.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  await posCustomerDisplayRepository.savePlaylist({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    expectedVersion: input.value.expected_version,
    playlist: input.value.playlist,
    actionTime: parseActionTime(input.value.action_time),
    context: input.auditMetadata,
    source: input.source,
  });
  return getPosCustomerDisplaySettingsView(input.warehouseId);
};

export const uploadPosCustomerDisplayMedia = async (input: {
  warehouseId: string;
  actorId: string;
  expectedVersion: number;
  actionTime: string;
  fileName: string;
  buffer: Buffer;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
  source: "JPULSE" | "JPOS";
}): Promise<PosCustomerDisplaySettingsView> => {
  input.authorization.assert("pos.advertising.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  const inspected = inspectCustomerDisplayMedia(input.buffer);
  const mediaId = randomUUID();
  const now = new Date();
  const storagePath = `pos/customer-display/${input.warehouseId}/${mediaId}.${inspected.extension}`;
  const media: PosCustomerDisplayMedia = {
    id: mediaId,
    warehouse_id: input.warehouseId,
    type: inspected.type,
    storage_path: storagePath,
    file_name: sanitizeCustomerDisplayFileName(input.fileName),
    mime_type: inspected.mimeType,
    file_size_bytes: input.buffer.length,
    checksum_sha256: inspected.checksum,
    width: null,
    height: null,
    duration_seconds: inspected.durationSeconds,
    created_by: input.actorId,
    updated_by: input.actorId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  const file = storage.bucket().file(storagePath);
  await file.save(input.buffer, {
    resumable: false,
    metadata: {
      contentType: inspected.mimeType,
      cacheControl: "private, max-age=3600",
      metadata: { checksumSha256: inspected.checksum, warehouseId: input.warehouseId },
    },
  });
  try {
    await posCustomerDisplayRepository.createMedia({
      warehouseId: input.warehouseId,
      actorId: input.actorId,
      expectedVersion: input.expectedVersion,
      media,
      actionTime: parseActionTime(input.actionTime),
      context: input.auditMetadata,
      source: input.source,
    });
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch((cleanupError: unknown) => {
      console.error("[posCustomerDisplayService] Không thể dọn tệp upload lỗi:", cleanupError);
    });
    throw error;
  }
  return getPosCustomerDisplaySettingsView(input.warehouseId);
};

export const softDeletePosCustomerDisplayMedia = async (input: {
  warehouseId: string;
  mediaId: string;
  actorId: string;
  expectedVersion: number;
  actionTime: string;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
  source: "JPULSE" | "JPOS";
}): Promise<PosCustomerDisplaySettingsView> => {
  input.authorization.assert("pos.advertising.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  await posCustomerDisplayRepository.softDeleteMedia({
    warehouseId: input.warehouseId,
    mediaId: input.mediaId,
    actorId: input.actorId,
    expectedVersion: input.expectedVersion,
    actionTime: parseActionTime(input.actionTime),
    context: input.auditMetadata,
    source: input.source,
  });
  return getPosCustomerDisplaySettingsView(input.warehouseId);
};
