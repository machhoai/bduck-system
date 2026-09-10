import type { PosReceiptSettings } from "@bduck/shared-types";

import { posReceiptSettingsRepository } from "../repositories/posReceiptSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosReceiptSettingsInput } from "./posReceiptSettingsSchemas.js";
import {
  persistPosSettingsLogo,
  toAdminPosSettings,
} from "./posSettingsLogoStorageService.js";
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
  return toAdminPosSettings(
    await posReceiptSettingsRepository.findByWarehouse(warehouseId),
  );
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
  const current = await posReceiptSettingsRepository.findByWarehouse(
    input.warehouseId,
  );
  const logo = await persistPosSettingsLogo({
    warehouseId: input.warehouseId,
    logoDataUrl: input.value.logo_data_url,
    currentSettings: current,
  });
  const saved = await posReceiptSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: { ...input.value, ...logo },
    context: input.auditMetadata,
  });
  return (await toAdminPosSettings(saved))!;
};
