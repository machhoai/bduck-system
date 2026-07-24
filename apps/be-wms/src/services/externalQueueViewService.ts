import type { ApprovalRecord, ExternalScanQueue } from "@bduck/shared-types";
import * as approvalRepository from "../repositories/approvalRepository.js";
import { locationRepository } from "../repositories/locationRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import { roleRepository } from "../repositories/roleRepository.js";
import { getUsersByIds } from "../repositories/userRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { AuthenticatedRequestUser } from "../api/middlewares/requestAccessContext.js";
import type { AuthorizationService } from "./authorization/index.js";
import { resolveExternalQueueNextApproval } from "./externalQueueApprovalProgress.js";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  )
    return (value as { toDate: () => Date }).toDate();
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  )
    return new Date((value as { seconds: number }).seconds * 1000);
  return new Date(value as string | number);
};

const timestamp = (value: unknown): number => {
  const date = value ? toDate(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const operatorName = (record: ExternalScanQueue): string => {
  const name = record.operator_name?.trim();
  return name && !name.includes("@")
    ? name
    : record.operator_id_external || name || "Unknown";
};

const loadLookups = async (records: readonly ExternalScanQueue[]) => {
  const unique = (values: Array<string | null | undefined>) =>
    Array.from(
      new Set(values.filter((value): value is string => Boolean(value))),
    );
  const locationIds = unique(
    records.map((record) => record.warehouse_location_id),
  );
  const warehouseIds = unique(records.map((record) => record.warehouse_id));
  const approverIds = unique(
    records.flatMap((record) => [
      record.approved_by,
      record.final_approved_by ?? null,
    ]),
  );
  const exportVoucherIds = unique(
    records.map((record) => record.export_voucher_id),
  );
  const [products, locations, warehouses, approvers, approvalRecords] =
    await Promise.all([
      productRepository.findByIds(records.map((record) => record.product_id)),
      Promise.all(
        locationIds.map(
          async (id) => [id, await locationRepository.findById(id)] as const,
        ),
      ),
      Promise.all(
        warehouseIds.map(
          async (id) => [id, await warehouseRepository.findById(id)] as const,
        ),
      ),
      getUsersByIds(approverIds),
      approvalRepository.findByEntityIds(exportVoucherIds),
    ]);
  const exportApprovalRecords = approvalRecords.filter(
    (record) =>
      record.entity_type === "EXPORT_VOUCHER" &&
      exportVoucherIds.includes(record.entity_id),
  );
  const roles = await roleRepository.findByIds(
    exportApprovalRecords.map((record) => record.role_id),
  );
  const approvalRecordsByEntity = new Map<string, ApprovalRecord[]>();
  for (const record of exportApprovalRecords) {
    const entityRecords = approvalRecordsByEntity.get(record.entity_id) ?? [];
    entityRecords.push(record);
    approvalRecordsByEntity.set(record.entity_id, entityRecords);
  }

  return {
    products: new Map(products.map((product) => [product.id, product])),
    locations: new Map(locations),
    warehouses: new Map(warehouses),
    approvers: new Map(approvers.map((user) => [user.id, user])),
    roles: new Map(roles.map((role) => [role.id, role.name])),
    approvalRecordsByEntity,
  };
};

export const buildExternalQueueBatchViews = async (
  records: readonly ExternalScanQueue[],
  authorization: AuthorizationService,
  includeHistory: boolean,
  user?: AuthenticatedRequestUser,
): Promise<Record<string, unknown>[]> => {
  const lookup = await loadLookups(records);
  const groups = new Map<string, Record<string, any>>();
  for (const record of records) {
    if (includeHistory && !record.batch_id) continue;
    const date = toDate(record.scan_time).toISOString().slice(0, 10);
    const key =
      record.batch_id ?? `DRAFT-${record.warehouse_location_id}-${date}`;
    const product = lookup.products.get(record.product_id);
    const location = lookup.locations.get(record.warehouse_location_id);
    const warehouse = lookup.warehouses.get(record.warehouse_id);
    const name = operatorName(record);
    const canViewPrice = authorization.can(
      "products.price.view",
      record.warehouse_id,
    );
    const processedById = record.final_approved_by || record.approved_by;
    const processedBy = processedById
      ? lookup.approvers.get(processedById)
      : null;
    const processedAt = record.final_approved_at || record.approved_at;
    if (!groups.has(key)) {
      groups.set(key, {
        batch_id: key,
        warehouse_id: record.warehouse_id,
        warehouse_name: warehouse?.name ?? null,
        warehouse_code: warehouse?.code ?? null,
        warehouse_location_id: record.warehouse_location_id,
        location_name: location?.name ?? null,
        location_code: location?.code ?? null,
        operator_name: name,
        operator_names: [],
        queue_date: date,
        shift_date: record.scan_time,
        last_scan_time: record.scan_time,
        submitted_at: record.batch_id ? record.sync_time : null,
        processed_at: processedAt,
        status: record.status,
        is_draft: !record.batch_id,
        approved_by: record.approved_by,
        approved_by_name: record.approved_by
          ? (lookup.approvers.get(record.approved_by)?.full_name ??
            record.approved_by)
          : null,
        final_approved_by: record.final_approved_by ?? null,
        final_approved_at: record.final_approved_at ?? null,
        processed_by_name: processedBy?.full_name ?? processedById ?? null,
        approved_at: record.approved_at,
        export_voucher_id: record.export_voucher_id,
        rejection_reason: record.rejection_reason,
        revision_requested_by: record.revision_requested_by ?? null,
        revision_requested_at: record.revision_requested_at ?? null,
        notes: record.notes,
        total_products: 0,
        total_quantity: 0,
        total_value: 0,
        can_view_price: canViewPrice,
        product_ids: new Set<string>(),
        items: [],
      });
    }
    const group = groups.get(key)!;
    if (!group.operator_names.includes(name)) group.operator_names.push(name);
    if (timestamp(record.scan_time) > timestamp(group.last_scan_time)) {
      group.last_scan_time = record.scan_time;
    }
    group.total_quantity += record.quantity;
    group.total_value += record.quantity * record.unit_price;
    group.can_view_price = group.can_view_price && canViewPrice;
    if (!group.product_ids.has(record.product_id)) {
      group.product_ids.add(record.product_id);
      group.total_products += 1;
    }
    group.items.push({
      scan_id: record.id,
      product_id: record.product_id,
      product_name: product?.name ?? null,
      product_code: product?.code ?? null,
      product_barcode: product?.barcode ?? null,
      product_unit: product?.unit ?? null,
      product_image_url: product?.product_image_url?.[0] ?? null,
      barcode: record.barcode_scanned,
      quantity: record.quantity,
      unit_price: canViewPrice ? record.unit_price : null,
      scan_time: record.scan_time,
      operator_name: name,
      operator_id_external: record.operator_id_external,
      rejection_reason: record.rejection_reason,
      notes: record.notes,
    });
  }
  return Array.from(groups.values())
    .map((group) => {
      if (!group.can_view_price) group.total_value = null;
      group.next_approval = group.export_voucher_id
        ? resolveExternalQueueNextApproval(
            lookup.approvalRecordsByEntity.get(group.export_voucher_id) ?? [],
            lookup.roles,
            user,
          )
        : null;
      delete group.product_ids;
      return group;
    })
    .sort(
      (left, right) =>
        timestamp(
          right.processed_at || right.submitted_at || right.last_scan_time,
        ) -
        timestamp(
          left.processed_at || left.submitted_at || left.last_scan_time,
        ),
    );
};
