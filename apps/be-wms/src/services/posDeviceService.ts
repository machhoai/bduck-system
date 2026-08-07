import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "crypto";

import {
  ActiveStatus,
  WarehouseType,
  type PosDevice,
  type PosDeviceActivationResult,
  type PosDeviceEnrollment,
  type PosDeviceEnrollmentGrant,
  type PosDeviceSessionResult,
  type PosDeviceStatus,
  type PosStoreOverview,
} from "@bduck/shared-types";

import { posDeviceRepository } from "../repositories/posDeviceRepository.js";
import { posPaymentSettingsRepository } from "../repositories/posPaymentSettingsRepository.js";
import { posReceiptSettingsRepository } from "../repositories/posReceiptSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { verifyMfa } from "./mfaService.js";
import { loadWarehouseById } from "./warehouseService.js";

const ENROLLMENT_TTL_MS = 10 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export class PosDeviceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly messages: { vi: string; zh: string },
  ) {
    super(messages.vi);
    this.name = "PosDeviceError";
  }
}

const getHashSecret = (): string => {
  const secret = process.env.POS_ENROLLMENT_HASH_SECRET?.trim();
  if (!secret) {
    throw new PosDeviceError(500, {
      vi: "Máy chủ chưa cấu hình bảo mật kích hoạt POS.",
      zh: "服务器尚未配置 POS 激活安全密钥。",
    });
  }
  return secret;
};

const hashValue = (value: string): string =>
  createHmac("sha256", getHashSecret()).update(value).digest("hex");

const assertStore = async (warehouseId: string): Promise<void> => {
  const warehouse = await loadWarehouseById(warehouseId);
  if (
    warehouse.type !== WarehouseType.STORE ||
    warehouse.status !== ActiveStatus.ACTIVE
  ) {
    throw new PosDeviceError(400, {
      vi: "Chỉ có thể quản lý máy POS tại cửa hàng đang hoạt động.",
      zh: "只能管理营业门店的 POS 设备。",
    });
  }
};

const withoutCredential = (
  device: PosDevice,
): Omit<PosDevice, "credential_hash"> => {
  const { credential_hash: _credentialHash, ...safeDevice } = device;
  return safeDevice;
};

export const openPosDeviceSession = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
}): Promise<PosDeviceSessionResult> => {
  const device = await posDeviceRepository.findById(input.deviceId);
  const receivedHash = createHash("sha256")
    .update(input.credential)
    .digest("hex");
  const stored = Buffer.from(device?.credential_hash || "", "utf8");
  const received = Buffer.from(receivedHash, "utf8");
  const matches =
    stored.length === received.length && timingSafeEqual(stored, received);
  if (!device || device.is_deleted || device.status !== "ACTIVE" || !matches) {
    throw new PosDeviceError(401, {
      vi: "Máy POS chưa được cấp quyền hoặc đã bị khóa.",
      zh: "POS 设备未获授权或已被锁定。",
    });
  }

  const activeDevice = await posDeviceRepository.touchHeartbeat(
    device.id,
    input.appVersion,
  );
  const [receiptSettings, paymentSettings] = await Promise.all([
    posReceiptSettingsRepository.findByWarehouse(device.warehouse_id),
    posPaymentSettingsRepository.findByWarehouse(device.warehouse_id),
  ]);
  return {
    device: withoutCredential(activeDevice),
    receipt_settings: receiptSettings,
    payment_settings: paymentSettings,
    server_time: new Date(),
  };
};

export const listPosDevices = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<Array<Omit<PosDevice, "credential_hash">>> => {
  authorization.assert("pos.devices.read", warehouseId);
  await assertStore(warehouseId);
  const devices = await posDeviceRepository.listByWarehouse(warehouseId);
  return devices.map(withoutCredential);
};

export const getPosStoreOverview = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosStoreOverview> => {
  authorization.assert("pos.devices.read", warehouseId);
  await assertStore(warehouseId);
  const [devices, receiptSettings] = await Promise.all([
    posDeviceRepository.listByWarehouse(warehouseId),
    posReceiptSettingsRepository.findByWarehouse(warehouseId),
  ]);
  const offlineBoundary = Date.now() - OFFLINE_THRESHOLD_MS;
  const active = devices.filter((device) => device.status === "ACTIVE");
  const heartbeats = active
    .map((device) => device.last_seen_at?.getTime() ?? 0)
    .filter((value) => value > 0);
  return {
    warehouse_id: warehouseId,
    active_devices: active.length,
    revoked_devices: devices.filter((device) => device.status === "REVOKED").length,
    offline_devices: active.filter(
      (device) => (device.last_seen_at?.getTime() ?? 0) < offlineBoundary,
    ).length,
    receipt_settings_version: receiptSettings?.version ?? null,
    latest_heartbeat_at:
      heartbeats.length > 0 ? new Date(Math.max(...heartbeats)) : null,
  };
};

export const createPosEnrollment = async (input: {
  warehouseId: string;
  otp: string;
  actorId: string;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosDeviceEnrollmentGrant> => {
  input.authorization.assert("pos.devices.manage", input.warehouseId);
  await assertStore(input.warehouseId);
  if (!(await verifyMfa(input.actorId, input.otp))) {
    throw new PosDeviceError(401, {
      vi: "Mã OTP không đúng hoặc đã hết hạn.",
      zh: "OTP 验证码错误或已过期。",
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ENROLLMENT_TTL_MS);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pairingCode = String(randomInt(0, 100_000_000)).padStart(8, "0");
    const codeHash = hashValue(pairingCode);
    const enrollment: PosDeviceEnrollment = {
      id: codeHash,
      warehouse_id: input.warehouseId,
      code_hash: codeHash,
      status: "PENDING",
      expires_at: expiresAt,
      created_by: input.actorId,
      used_by_device_id: null,
      used_at: null,
      revoked_by: null,
      revoked_at: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    try {
      await posDeviceRepository.createEnrollment(enrollment, input.auditMetadata);
      return {
        enrollment_id: enrollment.id,
        pairing_code: pairingCode,
        expires_at: expiresAt,
        warehouse_id: input.warehouseId,
      };
    } catch (error: unknown) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Không thể tạo mã kích hoạt POS.");
};

export const activatePosDevice = async (input: {
  pairingCode: string;
  deviceId: string;
  deviceCredential: string;
  deviceName: string;
  fingerprint: string;
  appVersion: string;
  operatingSystem: string;
}): Promise<PosDeviceActivationResult> => {
  const enrollmentId = hashValue(input.pairingCode);
  const now = new Date();
  const device: PosDevice = {
    id: input.deviceId,
    warehouse_id: "",
    name: input.deviceName,
    fingerprint_hash: hashValue(input.fingerprint),
    credential_hash: createHash("sha256")
      .update(input.deviceCredential)
      .digest("hex"),
    status: "ACTIVE",
    app_version: input.appVersion,
    operating_system: input.operatingSystem,
    enrolled_by: "",
    enrolled_at: now,
    last_seen_at: now,
    revoked_by: null,
    revoked_at: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  try {
    const enrollment = await posDeviceRepository.activateDevice({
      enrollmentId,
      device,
    });
    const activatedDevice = enrollment.device;
    return {
      device: withoutCredential(activatedDevice),
      device_credential: input.deviceCredential,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      ["POS_ENROLLMENT_NOT_FOUND", "POS_ENROLLMENT_NOT_USABLE"].includes(
        error.message,
      )
    ) {
      throw new PosDeviceError(400, {
        vi: "Mã kích hoạt không đúng, đã hết hạn hoặc đã được sử dụng.",
        zh: "激活码无效、已过期或已被使用。",
      });
    }
    throw error;
  }
};

export const changePosDeviceStatus = async (input: {
  deviceId: string;
  status: PosDeviceStatus;
  actorId: string;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<Omit<PosDevice, "credential_hash">> => {
  const previous = await posDeviceRepository.findById(input.deviceId);
  if (!previous || previous.is_deleted) {
    throw new PosDeviceError(404, {
      vi: "Không tìm thấy máy POS.",
      zh: "未找到 POS 设备。",
    });
  }
  input.authorization.assert("pos.devices.manage", previous.warehouse_id);
  const current = await posDeviceRepository.updateStatus(
    previous.id,
    input.status,
    input.actorId,
    input.auditMetadata,
  );
  return withoutCredential(current);
};
