import type {
  PosOrderPaymentStatus,
  PosOrderSummary,
  PosOrderSyncStatus,
} from "@bduck/shared-types";

export interface PosOrderFiltersValue {
  search: string;
  phone: string;
  paymentStatus: PosOrderPaymentStatus | "";
  syncStatus: PosOrderSyncStatus | "";
  operatorId: string;
  product: string;
  sortBy: "totalAmount" | "createdAt";
  sortDir: "asc" | "desc";
}

export const DEFAULT_POS_ORDER_FILTERS: PosOrderFiltersValue = {
  search: "",
  phone: "",
  paymentStatus: "",
  syncStatus: "",
  operatorId: "",
  product: "",
  sortBy: "createdAt",
  sortDir: "desc",
};

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase("vi");
const phone = (value: string): string => value.replace(/\D/g, "");

export const filterPosOrders = (
  orders: PosOrderSummary[],
  filters: PosOrderFiltersValue,
): PosOrderSummary[] => {
  const search = normalize(filters.search);
  const product = normalize(filters.product);
  const normalizedPhone = phone(filters.phone);
  return orders
    .filter(
      (order) =>
        (!search ||
          normalize(order.localOrderId).includes(search) ||
          normalize(order.hkOrderNumber ?? "").includes(search)) &&
        (!normalizedPhone ||
          phone(order.normalizedPhone ?? order.customerPhone ?? "").includes(
            normalizedPhone,
          )) &&
        (!filters.paymentStatus ||
          order.paymentStatus === filters.paymentStatus) &&
        (!filters.syncStatus || order.syncStatus === filters.syncStatus) &&
        (!filters.operatorId || order.operatorId === filters.operatorId) &&
        (!product ||
          order.productNames.some((name) => normalize(name).includes(product))),
    )
    .sort((left, right) => {
      const leftValue =
        filters.sortBy === "createdAt"
          ? new Date(left.createdAt).getTime()
          : left.totalAmount;
      const rightValue =
        filters.sortBy === "createdAt"
          ? new Date(right.createdAt).getTime()
          : right.totalAmount;
      const compared =
        leftValue - rightValue || left.id.localeCompare(right.id);
      return filters.sortDir === "asc" ? compared : -compared;
    });
};
