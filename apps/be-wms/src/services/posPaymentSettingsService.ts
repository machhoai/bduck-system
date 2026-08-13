import type {
  PosPaymentSettings,
  PosPaymentSettingsInput,
} from "@bduck/shared-types";
import { z } from "zod";

import { posPaymentSettingsRepository } from "../repositories/posPaymentSettingsRepository.js";
import { posDeviceRepository } from "../repositories/posDeviceRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { PosDeviceError } from "./posDeviceService.js";

export const posPaymentSettingsSchema = z
  .object({
    enabled: z.boolean(),
    fixedTransferOnly: z.boolean().default(false),
    bankBin: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,19}$/),
    accountName: z.string().trim().min(2).max(50),
  })
  .refine((value) => !value.fixedTransferOnly || value.enabled, {
    message: "Phải bật QR cố định trước khi dùng chế độ chỉ QR cố định.",
    path: ["fixedTransferOnly"],
  });

export const getPosPaymentSettings = async (
  deviceId: string,
  authorization: AuthorizationService,
): Promise<PosPaymentSettings | null> => {
  const device = await posDeviceRepository.findById(deviceId);
  if (!device || device.is_deleted) {
    throw new PosDeviceError(404, {
      vi: "Không tìm thấy máy POS.",
      zh: "未找到 POS 设备。",
    });
  }
  authorization.assert("pos.settings.read", device.warehouse_id);
  return posPaymentSettingsRepository.findByDevice(
    device.id,
    device.warehouse_id,
  );
};

export const savePosPaymentSettings = async (input: {
  deviceId: string;
  actorId: string;
  value: PosPaymentSettingsInput;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosPaymentSettings> => {
  const device = await posDeviceRepository.findById(input.deviceId);
  if (!device || device.is_deleted) {
    throw new PosDeviceError(404, {
      vi: "Không tìm thấy máy POS.",
      zh: "未找到 POS 设备。",
    });
  }
  input.authorization.assert("pos.settings.manage", device.warehouse_id);
  return posPaymentSettingsRepository.save({
    deviceId: device.id,
    warehouseId: device.warehouse_id,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
