import { createHash, timingSafeEqual } from "crypto";

import type {
  PosDevice,
  PosDeviceSessionResult,
  PosReceiptSettingsWatchResult,
} from "@bduck/shared-types";

import { posDeviceRepository } from "../repositories/posDeviceRepository.js";
import { posPaymentSettingsRepository } from "../repositories/posPaymentSettingsRepository.js";
import { posReceiptSettingsRepository } from "../repositories/posReceiptSettingsRepository.js";

import { PosDeviceError } from "./posDeviceService.js";

const requireActivePosDevice = async (input: {
  deviceId: string;
  credential: string;
}): Promise<PosDevice> => {
  const device = await posDeviceRepository.findById(input.deviceId);
  const receivedHash = createHash("sha256").update(input.credential).digest("hex");
  const stored = Buffer.from(device?.credential_hash || "", "utf8");
  const received = Buffer.from(receivedHash, "utf8");
  const matches = stored.length === received.length && timingSafeEqual(stored, received);
  if (!device || device.is_deleted || device.status !== "ACTIVE" || !matches) {
    throw new PosDeviceError(401, {
      vi: "Máy POS chưa được cấp quyền hoặc đã bị khóa.",
      zh: "POS 设备未获授权或已被锁定。",
    });
  }
  return device;
};

export const openPosDeviceSession = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
}): Promise<PosDeviceSessionResult> => {
  const device = await requireActivePosDevice(input);
  const activeDevice = await posDeviceRepository.touchHeartbeat(device.id, input.appVersion);
  const [receiptSettings, paymentSettings] = await Promise.all([
    posReceiptSettingsRepository.findByWarehouse(device.warehouse_id),
    posPaymentSettingsRepository.findByWarehouse(device.warehouse_id),
  ]);
  const { credential_hash: _credentialHash, ...safeDevice } = activeDevice;
  return {
    device: safeDevice,
    receipt_settings: receiptSettings,
    payment_settings: paymentSettings,
    server_time: new Date(),
  };
};

export const watchPosReceiptSettings = async (input: {
  deviceId: string;
  credential: string;
  knownVersion: number | null;
  signal?: AbortSignal;
}): Promise<PosReceiptSettingsWatchResult> => {
  const device = await requireActivePosDevice(input);
  const result = await posReceiptSettingsRepository.waitForVersionChange(
    device.warehouse_id,
    input.knownVersion,
    25_000,
    input.signal,
  );
  return {
    changed: result.changed,
    receipt_settings: result.settings,
    server_time: new Date(),
  };
};
