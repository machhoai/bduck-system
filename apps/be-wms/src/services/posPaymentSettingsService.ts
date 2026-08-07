import type { PosPaymentSettings, PosPaymentSettingsInput } from "@bduck/shared-types";
import { z } from "zod";

import { posPaymentSettingsRepository } from "../repositories/posPaymentSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { loadWarehouseById } from "./warehouseService.js";

export const posPaymentSettingsSchema = z.object({
  enabled: z.boolean(),
  bankBin: z.string().trim().regex(/^\d{6}$/),
  accountNumber: z.string().trim().regex(/^\d{6,19}$/),
  accountName: z.string().trim().min(2).max(50),
});

export const getPosPaymentSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosPaymentSettings | null> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  return posPaymentSettingsRepository.findByWarehouse(warehouseId);
};

export const savePosPaymentSettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosPaymentSettingsInput;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosPaymentSettings> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  return posPaymentSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
