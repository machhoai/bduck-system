import type { TransferOrder, TransferOrderItem } from "@bduck/shared-types";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import { executeFacilityScopedQuery } from "../repositories/facilityScopedQuery.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertTransferReadAccess,
  loadTransferOrder,
} from "./transferAccessPolicy.js";

export interface TransferOrderFilters {
  source_warehouse_id?: string;
  destination_warehouse_id?: string;
  transfer_type?: string;
  status?: string;
}

const sortableTime = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value.toDate as () => Date)().getTime();
  }
  return 0;
};

export async function listTransferOrders(
  filters: TransferOrderFilters,
  authorization: AuthorizationService,
): Promise<TransferOrder[]> {
  if (authorization.context.isSystemAdmin) {
    return transferRepo.findAll(filters);
  }

  const facilityIds = authorization.facilityIdsFor("transfers.read");
  const scope = { isSystemAdmin: false, facilityIds };
  const [sourceGroups, destinationGroups] = await Promise.all([
    executeFacilityScopedQuery({
      ...scope,
      queryAll: () => transferRepo.findAll(filters),
      queryChunk: (ids) =>
        transferRepo.findAllByFacilityScope(
          "source_warehouse_id",
          ids,
          filters,
        ),
    }),
    executeFacilityScopedQuery({
      ...scope,
      queryAll: () => transferRepo.findAll(filters),
      queryChunk: (ids) =>
        transferRepo.findAllByFacilityScope(
          "destination_warehouse_id",
          ids,
          filters,
        ),
    }),
  ]);

  const uniqueOrders = new Map<string, TransferOrder>();
  [...sourceGroups, ...destinationGroups]
    .flat()
    .forEach((order) => uniqueOrders.set(order.id, order));
  return [...uniqueOrders.values()].sort(
    (left, right) =>
      sortableTime(right.created_at) - sortableTime(left.created_at),
  );
}

export interface TransferOrderDetail {
  order: TransferOrder;
  items: TransferOrderItem[];
}

export async function getTransferOrderById(
  id: string,
  authorization: AuthorizationService,
): Promise<TransferOrderDetail> {
  const order = await loadTransferOrder(id);
  assertTransferReadAccess(authorization, order);

  let items = await transferRepo.findItemsByOrderId(id);
  if (
    items.length === 0 &&
    "items" in order &&
    Array.isArray((order as TransferOrder & { items?: unknown }).items)
  ) {
    items = (order as TransferOrder & { items: TransferOrderItem[] }).items;
  }

  return { order, items };
}
