import type {
  PosProductVisibilitySettings,
  PosProductVisibilitySettingsView,
} from "@bduck/shared-types";

import { posProductVisibilityRepository } from "../repositories/posProductVisibilityRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { PosProductVisibilitySettingsValue } from "./posProductVisibilitySchemas.js";
import { loadWarehouseById } from "./warehouseService.js";

export const getPosProductVisibilitySettings = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<PosProductVisibilitySettingsView> => {
  authorization.assert("pos.settings.read", warehouseId);
  await loadWarehouseById(warehouseId);
  const [settings, products] = await Promise.all([
    posProductVisibilityRepository.findByWarehouse(warehouseId),
    posProductVisibilityRepository.listCatalog(),
  ]);
  return { settings, products };
};

export const savePosProductVisibilitySettings = async (input: {
  warehouseId: string;
  actorId: string;
  value: PosProductVisibilitySettingsValue;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
  source: "JPULSE" | "JPOS";
}): Promise<PosProductVisibilitySettings> => {
  input.authorization.assert("pos.settings.manage", input.warehouseId);
  await loadWarehouseById(input.warehouseId);
  return posProductVisibilityRepository.save({
    warehouseId: input.warehouseId,
    actorId: input.actorId,
    value: input.value,
    context: input.auditMetadata,
    source: input.source,
  });
};

