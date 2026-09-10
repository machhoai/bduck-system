import { createHash } from "crypto";

import type { PosReceiptSettings, PosTicketSettings } from "@bduck/shared-types";

import { storage } from "../config/firebase.js";

type LogoContentType = "image/jpeg" | "image/png" | "image/webp";
type SettingsKind = "receipt" | "ticket";
type SettingsWithLogo = PosReceiptSettings | PosTicketSettings;

export interface PersistedPosSettingsLogo {
  logo_data_url: null;
  logo_storage_path: string | null;
  logo_checksum_sha256: string | null;
  logo_content_type: LogoContentType | null;
  logo_file_size_bytes: number | null;
}

const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/;

const extensionByContentType: Record<LogoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const emptyLogo = (): PersistedPosSettingsLogo => ({
  logo_data_url: null,
  logo_storage_path: null,
  logo_checksum_sha256: null,
  logo_content_type: null,
  logo_file_size_bytes: null,
});

const currentLogo = (
  settings: SettingsWithLogo | null,
): PersistedPosSettingsLogo | null => {
  if (
    !settings?.logo_storage_path ||
    !settings.logo_checksum_sha256 ||
    !settings.logo_content_type ||
    !settings.logo_file_size_bytes
  ) {
    return null;
  }
  return {
    logo_data_url: null,
    logo_storage_path: settings.logo_storage_path,
    logo_checksum_sha256: settings.logo_checksum_sha256,
    logo_content_type: settings.logo_content_type,
    logo_file_size_bytes: settings.logo_file_size_bytes,
  };
};

export const persistPosSettingsLogo = async (input: {
  warehouseId: string;
  logoDataUrl: string | null;
  currentSettings: SettingsWithLogo | null;
}): Promise<PersistedPosSettingsLogo> => {
  if (input.logoDataUrl === null) return emptyLogo();

  const match = DATA_URL_PATTERN.exec(input.logoDataUrl);
  if (!match) {
    const existing = currentLogo(input.currentSettings);
    if (existing) return existing;
    throw Object.assign(new Error("POS_SETTINGS_LOGO_SOURCE_INVALID"), {
      statusCode: 400,
      messages: {
        vi: "Nguồn logo không hợp lệ. Vui lòng tải ảnh lên lại.",
        zh: "Logo 来源无效，请重新上传图片。",
      },
    });
  }

  const contentType = match[1] as LogoContentType;
  const buffer = Buffer.from(match[2], "base64");
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = extensionByContentType[contentType];
  const storagePath = `pos/settings-logos/${input.warehouseId}/${checksum}.${extension}`;
  const file = storage.bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    try {
      await file.save(buffer, {
        resumable: false,
        validation: "crc32c",
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType,
          cacheControl: "private, max-age=31536000, immutable",
          metadata: { checksumSha256: checksum, warehouseId: input.warehouseId },
        },
      });
    } catch (error) {
      const code = Number((error as { code?: unknown }).code);
      if (code !== 409 && code !== 412) throw error;
    }
  }

  return {
    logo_data_url: null,
    logo_storage_path: storagePath,
    logo_checksum_sha256: checksum,
    logo_content_type: contentType,
    logo_file_size_bytes: buffer.length,
  };
};

export const createPosSettingsLogoContentUrl = (
  kind: SettingsKind,
  settings: SettingsWithLogo,
): string | null =>
  settings.logo_checksum_sha256
    ? `/api/pos/devices/settings-logo/${kind}/${settings.logo_checksum_sha256}/content`
    : null;

export const toDevicePosSettings = <T extends SettingsWithLogo>(
  kind: SettingsKind,
  settings: T | null,
): T | null => {
  if (!settings) return null;
  if (!settings.logo_storage_path) return settings;
  return {
    ...settings,
    logo_data_url: null,
    logo_content_url: createPosSettingsLogoContentUrl(kind, settings),
  };
};

export const toLegacyDevicePosSettings = async <T extends SettingsWithLogo>(
  settings: T | null,
): Promise<T | null> => {
  if (!settings?.logo_storage_path || !settings.logo_content_type) return settings;
  const [buffer] = await storage.bucket().file(settings.logo_storage_path).download();
  return {
    ...settings,
    logo_data_url: `data:${settings.logo_content_type};base64,${buffer.toString("base64")}`,
  };
};

export const toAdminPosSettings = async <T extends SettingsWithLogo>(
  settings: T | null,
): Promise<T | null> => {
  if (!settings?.logo_storage_path) return settings;
  const [url] = await storage
    .bucket()
    .file(settings.logo_storage_path)
    .getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
  return { ...settings, logo_data_url: url };
};

export const readPosSettingsLogo = async (input: {
  kind: SettingsKind;
  checksum: string;
  receiptSettings: PosReceiptSettings | null;
  ticketSettings: PosTicketSettings | null;
}): Promise<{ buffer: Buffer; contentType: LogoContentType; checksum: string }> => {
  const settings = input.kind === "receipt" ? input.receiptSettings : input.ticketSettings;
  if (
    !settings?.logo_storage_path ||
    settings.logo_checksum_sha256 !== input.checksum ||
    !settings.logo_content_type
  ) {
    throw Object.assign(new Error("POS_SETTINGS_LOGO_NOT_FOUND"), {
      statusCode: 404,
      messages: { vi: "Không tìm thấy logo cấu hình POS.", zh: "未找到 POS 配置 Logo。" },
    });
  }
  const [buffer] = await storage.bucket().file(settings.logo_storage_path).download();
  return { buffer, contentType: settings.logo_content_type, checksum: input.checksum };
};
