import type { ExportVoucher, ImportVoucher } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { locationRepository } from "../repositories/locationRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { assertFacilityRelationship } from "./facilityRelationshipPolicy.js";

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Chứng từ không tồn tại hoặc đã bị xóa.",
    zh: "单据不存在或已被删除。",
  },
};

export const loadImportVoucher = async (
  voucherId: string,
): Promise<ImportVoucher> => {
  const snapshot = await db.collection("import_vouchers").doc(voucherId).get();
  if (!snapshot.exists) throw notFoundError;
  const voucher = snapshot.data() as ImportVoucher;
  if (voucher.is_deleted) throw notFoundError;
  return voucher;
};

export const loadExportVoucher = async (
  voucherId: string,
): Promise<ExportVoucher> => {
  const snapshot = await db.collection("export_vouchers").doc(voucherId).get();
  if (!snapshot.exists) throw notFoundError;
  const voucher = snapshot.data() as ExportVoucher;
  if (voucher.is_deleted) throw notFoundError;
  return voucher;
};

export const assertVoucherAccess = (
  authorization: AuthorizationService,
  action: "vouchers.read" | "vouchers.write",
  warehouseId: string,
): void => authorization.assert(action, warehouseId);

export const assertVoucherItemLocations = async (
  warehouseId: string,
  locationIds: readonly string[],
): Promise<void> => {
  const uniqueIds = Array.from(new Set(locationIds));
  const locations = await Promise.all(
    uniqueIds.map((locationId) => locationRepository.findById(locationId)),
  );
  for (const location of locations) {
    if (!location || location.is_deleted) throw notFoundError;
    assertFacilityRelationship(warehouseId, location.warehouse_id);
  }
};
