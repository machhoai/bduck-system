import { createHash, timingSafeEqual } from "crypto";

import type {
  PosDevice,
  PosDeviceConfigSyncResult,
  PosDeviceConfigVersions,
  PosDeviceHeartbeatResult,
  PosDeviceSessionResult,
  PosReceiptSettings,
  PosTicketSettings,
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
import {
  persistPosSettingsLogo,
  readPosSettingsLogo,
  toDevicePosSettings,
  toLegacyDevicePosSettings,
} from "./posSettingsLogoStorageService.js";
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
  await posDeviceRepository.touchHeartbeat(device, input.appVersion);
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
  const { credential_hash: _credentialHash, ...safeDevice } = device;
  const [legacyReceiptSettings, legacyTicketSettings] = await Promise.all([
    toLegacyDevicePosSettings(receiptSettings),
    toLegacyDevicePosSettings(ticketSettings),
  ]);
  return {
    device: safeDevice,
    receipt_settings: legacyReceiptSettings,
    ticket_settings: legacyTicketSettings,
    payment_settings: paymentSettings,
    customer_display_settings: customerDisplaySettings,
    server_time: new Date(),
  };
};

export const heartbeatPosDevice = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
}): Promise<PosDeviceHeartbeatResult> => {
  const device = await requireActivePosDevice(input);
  await posDeviceRepository.touchHeartbeat(device, input.appVersion);
  const { credential_hash: _credentialHash, ...safeDevice } = device;
  return { device: safeDevice, server_time: new Date() };
};

const configVersions = (input: {
  receipt: PosReceiptSettings | null;
  ticket: PosTicketSettings | null;
  payment: Awaited<ReturnType<typeof posPaymentSettingsRepository.findByDevice>>;
  customerDisplay: Awaited<ReturnType<typeof posCustomerDisplayRepository.findSettings>>;
}): PosDeviceConfigVersions => ({
  receipt_settings: input.receipt?.version ?? null,
  ticket_settings: input.ticket?.version ?? null,
  payment_settings: input.payment?.version ?? null,
  customer_display_settings: input.customerDisplay?.version ?? null,
});

export const syncPosDeviceConfig = async (input: {
  deviceId: string;
  credential: string;
  knownVersions: PosDeviceConfigVersions;
}): Promise<PosDeviceConfigSyncResult> => {
  const device = await requireActivePosDevice(input);
  const [receipt, ticket, payment, customerDisplay] = await Promise.all([
    posReceiptSettingsRepository.findByWarehouse(device.warehouse_id),
    posTicketSettingsRepository.findByWarehouse(device.warehouse_id),
    posPaymentSettingsRepository.findByDevice(device.id, device.warehouse_id),
    posCustomerDisplayRepository.findSettings(device.warehouse_id),
  ]);
  const versions = configVersions({ receipt, ticket, payment, customerDisplay });
  const changed = {
    receipt_settings: versions.receipt_settings !== input.knownVersions.receipt_settings,
    ticket_settings: versions.ticket_settings !== input.knownVersions.ticket_settings,
    payment_settings: versions.payment_settings !== input.knownVersions.payment_settings,
    customer_display_settings:
      versions.customer_display_settings !== input.knownVersions.customer_display_settings,
  };
  return {
    versions,
    changed,
    receipt_settings: changed.receipt_settings
      ? toDevicePosSettings("receipt", receipt)
      : null,
    ticket_settings: changed.ticket_settings
      ? toDevicePosSettings("ticket", ticket)
      : null,
    payment_settings: changed.payment_settings ? payment : null,
    customer_display_settings: changed.customer_display_settings
      ? await getPosCustomerDisplaySettingsView(device.warehouse_id, "DEVICE")
      : null,
    server_time: new Date(),
  };
};

export const getPosSettingsLogoContent = async (input: {
  deviceId: string;
  credential: string;
  kind: "receipt" | "ticket";
  checksum: string;
}) => {
  const device = await requireActivePosDevice(input);
  const [receiptSettings, ticketSettings] = await Promise.all([
    input.kind === "receipt"
      ? posReceiptSettingsRepository.findByWarehouse(device.warehouse_id)
      : Promise.resolve(null),
    input.kind === "ticket"
      ? posTicketSettingsRepository.findByWarehouse(device.warehouse_id)
      : Promise.resolve(null),
  ]);
  return readPosSettingsLogo({
    kind: input.kind,
    checksum: input.checksum,
    receiptSettings,
    ticketSettings,
  });
};

export const savePosReceiptSettingsFromDevice = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
  value: PosReceiptSettingsInput;
  auditMetadata?: AuditMetadata;
}): Promise<PosReceiptSettings> => {
  const device = await requireActivePosDevice(input);
  const current = await posReceiptSettingsRepository.findByWarehouse(
    device.warehouse_id,
  );
  const logo = await persistPosSettingsLogo({
    warehouseId: device.warehouse_id,
    logoDataUrl: input.value.logo_data_url,
    currentSettings: current,
  });
  await posDeviceRepository.touchHeartbeat(device, input.appVersion);
  const saved = await posReceiptSettingsRepository.save({
    warehouseId: device.warehouse_id,
    actorId: device.id,
    value: { ...input.value, ...logo },
    context: {
      ...input.auditMetadata,
      device_id: device.id,
    },
    source: "JPOS",
  });
  return (await toLegacyDevicePosSettings(saved))!;
};

export const savePosTicketSettingsFromDevice = async (input: {
  deviceId: string;
  credential: string;
  appVersion: string;
  value: PosTicketSettingsInput;
  auditMetadata?: AuditMetadata;
}): Promise<PosTicketSettings> => {
  const device = await requireActivePosDevice(input);
  const current = await posTicketSettingsRepository.findByWarehouse(
    device.warehouse_id,
  );
  const logo = await persistPosSettingsLogo({
    warehouseId: device.warehouse_id,
    logoDataUrl: input.value.logo_data_url,
    currentSettings: current,
  });
  await posDeviceRepository.touchHeartbeat(device, input.appVersion);
  const saved = await posTicketSettingsRepository.save({
    warehouseId: device.warehouse_id,
    actorId: device.id,
    value: { ...input.value, ...logo },
    context: { ...input.auditMetadata, device_id: device.id },
    source: "JPOS",
  });
  return (await toLegacyDevicePosSettings(saved))!;
};
