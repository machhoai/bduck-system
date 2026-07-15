import {
  ExportVoucherStatus,
  type ExportVoucher,
  type ExportVoucherItem,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { executeFacilityScopedQuery } from "../repositories/facilityScopedQuery.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertVoucherAccess,
  loadExportVoucher,
} from "./voucherAccessPolicy.js";

const ACTIVE_STATUSES = [
  ExportVoucherStatus.DRAFT,
  ExportVoucherStatus.PENDING_APPROVAL,
  ExportVoucherStatus.APPROVED,
  ExportVoucherStatus.REJECTED,
  ExportVoucherStatus.PICKING,
  ExportVoucherStatus.SHIPPED,
];

const COMPLETED_STATUSES = [
  ExportVoucherStatus.COMPLETED,
  ExportVoucherStatus.CANCELLED,
];

const toMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
};

const queryByStatuses = async (
  statuses: readonly ExportVoucherStatus[],
  facilityIds?: readonly string[],
): Promise<ExportVoucher[]> => {
  let query: FirebaseFirestore.Query = db
    .collection("export_vouchers")
    .where("is_deleted", "==", false);
  if (facilityIds) query = query.where("warehouse_id", "in", facilityIds);
  else query = query.where("status", "in", statuses);
  const snapshot = await query.orderBy("created_at", "desc").get();
  return snapshot.docs
    .map(
      (document) => ({ id: document.id, ...document.data() }) as ExportVoucher,
    )
    .filter((voucher) => statuses.includes(voucher.status));
};

const fetchByStatuses = async (
  statuses: readonly ExportVoucherStatus[],
  authorization: AuthorizationService,
): Promise<ExportVoucher[]> => {
  const groups = await executeFacilityScopedQuery({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("vouchers.read"),
    queryAll: () => queryByStatuses(statuses),
    queryChunk: (facilityIds) => queryByStatuses(statuses, facilityIds),
  });
  return groups
    .flat()
    .filter(
      (voucher, index, vouchers) =>
        vouchers.findIndex((candidate) => candidate.id === voucher.id) ===
        index,
    )
    .sort(
      (left, right) => toMillis(right.created_at) - toMillis(left.created_at),
    );
};

export const fetchActiveVouchers = (
  authorization: AuthorizationService,
): Promise<ExportVoucher[]> => fetchByStatuses(ACTIVE_STATUSES, authorization);

export const fetchCompletedVouchers = (
  authorization: AuthorizationService,
): Promise<ExportVoucher[]> =>
  fetchByStatuses(COMPLETED_STATUSES, authorization);

export const fetchVoucherWithItems = async (
  voucherId: string,
  authorization: AuthorizationService,
): Promise<{ voucher: ExportVoucher; items: ExportVoucherItem[] }> => {
  const voucher = await loadExportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.read", voucher.warehouse_id);
  const itemsSnapshot = await db
    .collection("export_vouchers")
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();
  return {
    voucher,
    items: itemsSnapshot.docs.map(
      (document) => document.data() as ExportVoucherItem,
    ),
  };
};

export const fetchAllVouchers = async (
  authorization: AuthorizationService,
  filters?: { warehouse_id?: string },
): Promise<ExportVoucher[]> => {
  if (filters?.warehouse_id) {
    assertVoucherAccess(authorization, "vouchers.read", filters.warehouse_id);
    const snapshot = await db
      .collection("export_vouchers")
      .where("is_deleted", "==", false)
      .where("warehouse_id", "==", filters.warehouse_id)
      .orderBy("created_at", "desc")
      .get();
    return snapshot.docs.map((document) => document.data() as ExportVoucher);
  }
  return fetchByStatuses(
    [...ACTIVE_STATUSES, ...COMPLETED_STATUSES],
    authorization,
  );
};
