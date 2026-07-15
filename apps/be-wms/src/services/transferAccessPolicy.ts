import {
  ActiveStatus,
  LocationStatus,
  WarehouseType,
  type TransferOrder,
} from "@bduck/shared-types";
import { locationRepository } from "../repositories/locationRepository.js";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { assertFacilityRelationship } from "./facilityRelationshipPolicy.js";

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Phiếu điều chuyển không tồn tại hoặc đã bị xóa.",
    zh: "调拨单不存在或已被删除。",
  },
};

const invalidFacilityError = {
  statusCode: 400,
  messages: {
    vi: "Cơ sở nguồn hoặc đích không hợp lệ để điều chuyển hàng.",
    zh: "调拨的来源或目标设施无效。",
  },
};

const invalidLocationError = {
  statusCode: 400,
  messages: {
    vi: "Vị trí nguồn hoặc đích không thuộc đúng cơ sở điều chuyển.",
    zh: "来源或目标库位不属于对应的调拨设施。",
  },
};

export const loadTransferOrder = async (
  orderId: string,
): Promise<TransferOrder> => {
  const order = await transferRepo.findById(orderId);
  if (!order || order.is_deleted !== false) throw notFoundError;
  return order;
};

export const assertTransferReadAccess = (
  authorization: AuthorizationService,
  order: Pick<
    TransferOrder,
    "source_warehouse_id" | "destination_warehouse_id"
  >,
): void =>
  authorization.assertCanReadTransfer(
    order.source_warehouse_id,
    order.destination_warehouse_id,
  );

export const assertTransferWriteAccess = (
  authorization: AuthorizationService,
  sourceFacilityId: string,
): void => authorization.assertCanWriteTransfer(sourceFacilityId);

export const assertTransferReceiveAccess = (
  authorization: AuthorizationService,
  destinationFacilityId: string,
): void => authorization.assertCanReceiveTransfer(destinationFacilityId);

export const assertTransferFacilities = async (
  sourceFacilityId: string,
  destinationFacilityId: string,
): Promise<void> => {
  const [source, destination] = await Promise.all([
    warehouseRepository.findById(sourceFacilityId),
    warehouseRepository.findById(destinationFacilityId),
  ]);
  const facilities = [source, destination];
  if (
    facilities.some(
      (facility) =>
        !facility ||
        facility.is_deleted !== false ||
        facility.status !== ActiveStatus.ACTIVE ||
        facility.type === WarehouseType.OFFICE,
    )
  ) {
    throw invalidFacilityError;
  }
};

export const assertTransferLocations = async (
  sourceFacilityId: string,
  destinationFacilityId: string,
  items: readonly {
    source_location_id: string;
    destination_location_id?: string | null;
  }[],
): Promise<void> => {
  const locationIds = Array.from(
    new Set(
      items.flatMap((item) =>
        item.destination_location_id
          ? [item.source_location_id, item.destination_location_id]
          : [item.source_location_id],
      ),
    ),
  );
  const locations = new Map(
    (
      await Promise.all(
        locationIds.map((locationId) =>
          locationRepository.findById(locationId),
        ),
      )
    ).flatMap((location) =>
      location ? [[location.id, location] as const] : [],
    ),
  );

  for (const item of items) {
    const source = locations.get(item.source_location_id);
    if (
      !source ||
      source.is_deleted !== false ||
      source.status !== LocationStatus.ACTIVE
    ) {
      throw invalidLocationError;
    }
    assertFacilityRelationship(sourceFacilityId, source.warehouse_id);

    if (item.destination_location_id) {
      const destination = locations.get(item.destination_location_id);
      if (
        !destination ||
        destination.is_deleted !== false ||
        destination.status !== LocationStatus.ACTIVE
      ) {
        throw invalidLocationError;
      }
      assertFacilityRelationship(
        destinationFacilityId,
        destination.warehouse_id,
      );
    }
  }
};

export const assertReceivingLocations = async (
  destinationFacilityId: string,
  locationIds: readonly string[],
): Promise<void> => {
  const locations = await Promise.all(
    Array.from(new Set(locationIds)).map((locationId) =>
      locationRepository.findById(locationId),
    ),
  );
  for (const location of locations) {
    if (
      !location ||
      location.is_deleted !== false ||
      location.status !== LocationStatus.ACTIVE
    ) {
      throw invalidLocationError;
    }
    assertFacilityRelationship(destinationFacilityId, location.warehouse_id);
  }
};
