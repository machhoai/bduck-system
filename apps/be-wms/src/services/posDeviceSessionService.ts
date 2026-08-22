import { createHash, timingSafeEqual } from "crypto";

import type {
  PosDevice,
  PosDeviceSessionResult,
  PosReceiptSettings,
  PosReceiptSettingsWatchResult,
  PosTicketSettings,
  PosTicketSettingsWatchResult,
  PosCustomerDisplaySettingsWatchResult,
} from "@bduck/shared-types";

import { posCustomerDisplayRepository } from "../repositories/posCustomerDisplayRepository.js";
import { posDeviceRepository } from "../repositories/posDeviceRepository.js";
import { posPaymentSettingsRepository } from "../repositories/posPaymentSettingsRepository.js";
import { posReceiptSettingsRepository } from "../repositories/posReceiptSettingsRepository.js";
import { posTicketSettingsRepository } from "../repositories/posTicketSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import { getPosCustomerDisplaySettingsView } from "./posCustomerDisplayService.js";
import { PosDeviceError } from "./posDeviceService.js";
import type { PosReceiptSettingsInput } from "./posReceiptSettingsSchemas.js";
import type { PosTicketSettingsInput } from "./posTicketSettingsSchemas.js";

export const requireActivePosDevice = async (input: {
  deviceId: string;
  credential: string;
}): Promise<PosDevice> => {
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
  return device;
};

export const openPosDeviceSession = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
}): Promise<PosDeviceSessionResult> => {
  const device = await requireActivePosDevice(input);
  const activeDevice = await posDeviceRepository.touchHeartbeat(
    device.id,
    input.appVersion,
  );
  const [
    receiptSettings,
    ticketSettings,
    paymentSettings,
    customerDisplaySettings,
  ] = await Promise.all([
    posReceiptSettingsRepository.findByWarehouse(device.warehouse_id),
    posTicketSettingsRepository.findByWarehouse(device.warehouse_id),
    posPaymentSettingsRepository.findByDevice(device.id, device.warehouse_id),
    getPosCustomerDisplaySettingsView(device.warehouse_id, "DEVICE"),
  ]);
  const { credential_hash: _credentialHash, ...safeDevice } = activeDevice;
  return {
    device: safeDevice,
    receipt_settings: receiptSettings,
    ticket_settings: ticketSettings,
    payment_settings: paymentSettings,
    customer_display_settings: customerDisplaySettings,
    server_time: new Date(),
  };
};

export const watchPosCustomerDisplaySettings = async (input: {
  deviceId: string;
  credential: string;
  knownVersion: number | null;
  signal?: AbortSignal;
}): Promise<PosCustomerDisplaySettingsWatchResult> => {
  const device = await requireActivePosDevice(input);
  const result = await posCustomerDisplayRepository.waitForVersionChange(
    device.warehouse_id,
    input.knownVersion,
    25_000,
    input.signal,
  );
  return {
    changed: result.changed,
    customer_display_settings: result.changed
      ? await getPosCustomerDisplaySettingsView(device.warehouse_id, "DEVICE")
      : null,
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

export const watchPosTicketSettings = async (input: {
  deviceId: string;
  credential: string;
  knownVersion: number | null;
  signal?: AbortSignal;
}): Promise<PosTicketSettingsWatchResult> => {
  const device = await requireActivePosDevice(input);
  const result = await posTicketSettingsRepository.waitForVersionChange(
    device.warehouse_id,
    input.knownVersion,
    25_000,
    input.signal,
  );
  return {
    changed: result.changed,
    ticket_settings: result.settings,
    server_time: new Date(),
  };
};

export const savePosReceiptSettingsFromDevice = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
  value: PosReceiptSettingsInput;
  auditMetadata?: AuditMetadata;
}): Promise<PosReceiptSettings> => {
  const device = await requireActivePosDevice(input);
  await posDeviceRepository.touchHeartbeat(device.id, input.appVersion);
  return posReceiptSettingsRepository.save({
    warehouseId: device.warehouse_id,
    actorId: device.id,
    value: input.value,
    context: {
      ...input.auditMetadata,
      device_id: device.id,
    },
    source: "JPOS",
  });
};

export const savePosTicketSettingsFromDevice = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
  value: PosTicketSettingsInput;
  auditMetadata?: AuditMetadata;
}): Promise<PosTicketSettings> => {
  const device = await requireActivePosDevice(input);
  await posDeviceRepository.touchHeartbeat(device.id, input.appVersion);
  return posTicketSettingsRepository.save({
    warehouseId: device.warehouse_id,
    actorId: device.id,
    value: input.value,
    context: { ...input.auditMetadata, device_id: device.id },
    source: "JPOS",
  });
};
