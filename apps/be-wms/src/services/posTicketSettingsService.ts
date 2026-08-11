import type { PosTicketSettings } from "@bduck/shared-types";

import { posTicketSettingsRepository } from "../repositories/posTicketSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosTicketSettingsInput } from "./posTicketSettingsSchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

export const getPosTicketSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosTicketSettings | null> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  return posTicketSettingsRepository.findByWarehouse(warehouseId);
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
  return posTicketSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
