import type { PosReceiptSettings } from "@bduck/shared-types";

import { posReceiptSettingsRepository } from "../repositories/posReceiptSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosReceiptSettingsInput } from "./posReceiptSettingsSchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

const assertWarehouse = async (warehouseId: string) => {
  await loadWarehouseById(warehouseId);
};

export const getPosReceiptSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosReceiptSettings | null> => {
  authorization.assert("pos.settings.read", warehouseId);
  await assertWarehouse(warehouseId);
  return posReceiptSettingsRepository.findByWarehouse(warehouseId);
};

export const savePosReceiptSettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosReceiptSettingsInput;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosReceiptSettings> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await assertWarehouse(input.warehouseId);
  return posReceiptSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
