import type {
  PosLuckyDrawSettings,
  PosLuckyDrawSettingsView,
} from "@bduck/shared-types";

import { posLuckyDrawSettingsRepository } from "../repositories/posLuckyDrawSettingsRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosLuckyDrawSettingsValue } from "./posLuckyDrawSettingsSchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

export const getPosLuckyDrawSettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosLuckyDrawSettingsView> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  const [settings, packages] = await Promise.all([
    posLuckyDrawSettingsRepository.findByWarehouse(warehouseId),
    posLuckyDrawSettingsRepository.listMemberPackages(),
  ]);
  return { settings, packages };
};

export const savePosLuckyDrawSettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosLuckyDrawSettingsValue;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosLuckyDrawSettings> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  return posLuckyDrawSettingsRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
  });
};
