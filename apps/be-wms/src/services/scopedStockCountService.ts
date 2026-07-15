import type { StockCountSession } from "@bduck/shared-types";
import { locationRepository } from "../repositories/locationRepository.js";
import {
  findSessionById,
  type StockCountSessionFilters,
} from "../repositories/stockCountRepository.js";
import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { assertFacilityRelationship } from "./facilityRelationshipPolicy.js";
import * as stockCountService from "./stockCountService.js";

const VIEW_ACTIONS = [
  "stock_counts.view",
  "stock_counts.create",
  "stock_counts.count",
  "external_count.view",
  "external_count.count",
] as const;
const CREATE_ACTIONS = ["stock_counts.create", "external_count.count"] as const;
const COUNT_ACTIONS = ["stock_counts.count", "external_count.count"] as const;
const CANCEL_ACTIONS = [
  "stock_counts.cancel",
  "external_count.cancel",
] as const;

const assertAnyAction = (
  authorization: AuthorizationService,
  actions: readonly string[],
  facilityId: string,
): void => {
  if (!actions.some((action) => authorization.can(action, facilityId))) {
    authorization.assert(actions[0], facilityId);
  }
};

const facilityIdsForAny = (
  authorization: AuthorizationService,
  actions: readonly string[],
): string[] =>
  Array.from(
    new Set(actions.flatMap((action) => authorization.facilityIdsFor(action))),
  ).sort();

const loadSession = async (sessionId: string): Promise<StockCountSession> => {
  const session = await findSessionById(sessionId);
  if (!session) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy phiên kiểm đếm.",
        zh: "未找到盘点会话。",
      },
    };
  }
  return session;
};

const listScoped = async <T>(
  filters: StockCountSessionFilters,
  authorization: AuthorizationService,
  actions: readonly string[],
  loader: (filters: StockCountSessionFilters) => Promise<T[]>,
): Promise<T[]> => {
  if (filters.warehouse_id) {
    assertAnyAction(authorization, actions, filters.warehouse_id);
    return loader(filters);
  }
  const groups = await Promise.all(
    facilityIdsForAny(authorization, actions).map((warehouseId) =>
      loader({ ...filters, warehouse_id: warehouseId }),
    ),
  );
  return groups.flat();
};

export const listInternalStockCountSessions = (
  filters: StockCountSessionFilters,
  authorization: AuthorizationService,
) =>
  listScoped(
    filters,
    authorization,
    VIEW_ACTIONS,
    stockCountService.listInternalStockCountSessions,
  );

export const getInternalStockCountDetail = async (
  sessionId: string,
  authorization: AuthorizationService,
) => {
  const session = await loadSession(sessionId);
  assertAnyAction(authorization, VIEW_ACTIONS, session.warehouse_id);
  return stockCountService.getInternalStockCountDetail(sessionId);
};

export const createInternalStockCountSession = async (
  input: stockCountService.InternalStockCountCreateInput,
  userId: string,
  clientIp: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  assertAnyAction(authorization, CREATE_ACTIONS, input.warehouse_id);
  const locations = await Promise.all(
    (input.warehouse_location_ids ?? []).map((id) =>
      locationRepository.findById(id),
    ),
  );
  for (const location of locations) {
    if (!location || location.is_deleted !== false) {
      throw {
        statusCode: 400,
        messages: { vi: "Vị trí không hợp lệ.", zh: "库位无效。" },
      };
    }
    assertFacilityRelationship(input.warehouse_id, location.warehouse_id);
  }
  return stockCountService.createInternalStockCountSession(
    input,
    userId,
    clientIp,
    auditMetadata,
  );
};

export const updateInternalStockCountItem = async (
  sessionId: string,
  itemId: string,
  input: stockCountService.InternalStockCountItemUpdateInput,
  userId: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  const session = await loadSession(sessionId);
  assertAnyAction(authorization, COUNT_ACTIONS, session.warehouse_id);
  return stockCountService.updateInternalStockCountItem(
    sessionId,
    itemId,
    input,
    userId,
    auditMetadata,
  );
};

export const submitInternalStockCountSession = async (
  sessionId: string,
  userId: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  const session = await loadSession(sessionId);
  assertAnyAction(authorization, COUNT_ACTIONS, session.warehouse_id);
  return stockCountService.submitInternalStockCountSession(
    sessionId,
    userId,
    auditMetadata,
  );
};

export const cancelInternalStockCountSession = async (
  sessionId: string,
  reason: string,
  userId: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
) => {
  const session = await loadSession(sessionId);
  assertAnyAction(authorization, CANCEL_ACTIONS, session.warehouse_id);
  return stockCountService.cancelInternalStockCountSession(
    sessionId,
    reason,
    userId,
    auditMetadata,
  );
};

export const listExternalCountSessions = (
  filters: StockCountSessionFilters,
  authorization: AuthorizationService,
) =>
  listScoped(
    filters,
    authorization,
    ["external_count.view", "external_count.count"],
    stockCountService.listExternalCountSessions,
  );

export const getExternalCountDetail = async (
  sessionId: string,
  authorization: AuthorizationService,
) => {
  const session = await loadSession(sessionId);
  assertAnyAction(
    authorization,
    ["external_count.view", "external_count.count"],
    session.warehouse_id,
  );
  return stockCountService.getExternalCountDetail(sessionId);
};
