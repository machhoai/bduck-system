import type { PosTicketSettings } from "@bduck/shared-types";

import { posTicketSettingsRepository } from "../repositories/posTicketSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  persistPosSettingsLogo,
  toAdminPosSettings,
} from "./posSettingsLogoStorageService.js";
import type { PosTicketSettingsInput } from "./posTicketSettingsSchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

export const getPosTicketSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosTicketSettings | null> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  return toAdminPosSettings(
    await posTicketSettingsRepository.findByWarehouse(warehouseId),
  );
};

export const savePosTicketSettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosTicketSettingsInput;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosTicketSettings> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  const current = await posTicketSettingsRepository.findByWarehouse(
    input.warehouseId,
  );
  const logo = await persistPosSettingsLogo({
    warehouseId: input.warehouseId,
    logoDataUrl: input.value.logo_data_url,
    currentSettings: current,
  });
  const saved = await posTicketSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: { ...input.value, ...logo },
    context: input.auditMetadata,
  });
  return (await toAdminPosSettings(saved))!;
};
