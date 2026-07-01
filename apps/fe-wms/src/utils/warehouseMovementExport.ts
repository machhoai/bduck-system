"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import type {
  ExportVoucher,
  ExportVoucherItem,
  ImportVoucher,
  ImportVoucherItem,
  Inventory,
  Product,
  ProductCategory,
  WarehouseLocation,
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import {
  ExportVoucherStatus,
  ImportVoucherStatus,
  LocationType,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import type {
  ExcelColumnConfig,
  ExportConfig,
  ExportDataKind,
  ExportRequestOptions,
} from "@/utils/exportExcel";

interface MovementRecord {
  dateKey: string;
  productId: string;
  importQty: number;
  exportQty: number;
  importLocationIds: Set<string>;
  exportLocationIds: Set<string>;
  importVouchers: Set<string>;
  exportVouchers: Set<string>;
  unitPrice: number | null;
}

interface WarehouseExportContext {
  warehouseId: string;
  warehouseName: string;
  inventory: Inventory[];
  products: Product[];
  categories: ProductCategory[];
  locations: WarehouseLocation[];
  slots?: WarehouseLocationSlot[];
  slotMappings?: WarehouseLocationSlotProduct[];
  importVouchers: ImportVoucher[];
  exportVouchers: ExportVoucher[];
  canViewPrice: boolean;
}

const MOVEMENT_EXPORT_KINDS = new Set<ExportDataKind>([
  "imports",
  "exports",
  "movement",
  "dailySummary",
  "counterDailySummary",
]);

function toFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "warehouse";
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      return candidate.toDate();
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value: unknown): string {
  const date = toDate(value);
  return date ? toDayKey(date) : "";
}

function toDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDayKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveRange(options: ExportRequestOptions) {
  const mode = options.dateMode ?? "month";

  if (mode === "date") {
    const day = options.date || toDayKey(new Date());
    return { startKey: day, endKey: day, label: day };
  }

  if (mode === "range") {
    const start = options.dateFrom || toDayKey(new Date());
    const end = options.dateTo || start;
    return start <= end
      ? { startKey: start, endKey: end, label: `${start}_${end}` }
      : { startKey: end, endKey: start, label: `${end}_${start}` };
  }

  const month = options.month || toDayKey(new Date()).slice(0, 7);
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  return {
    startKey: toDayKey(start),
    endKey: toDayKey(end),
    label: month,
  };
}

function getVoucherDate(voucher: ImportVoucher | ExportVoucher): Date | null {
  return (
    toDate(voucher.updated_at) ||
    toDate(voucher.action_time) ||
    toDate(voucher.created_at)
  );
}

function isEffectiveImport(voucher: ImportVoucher) {
  return voucher.status === ImportVoucherStatus.COMPLETED;
}

function isEffectiveExport(voucher: ExportVoucher) {
  return (
    voucher.status === ExportVoucherStatus.SHIPPED ||
    voucher.status === ExportVoucherStatus.COMPLETED
  );
}

async function getImportItems(voucherId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "import_vouchers", voucherId, "items"),
      where("is_deleted", "==", false),
    ),
  );
  return snapshot.docs.map((doc) => doc.data() as ImportVoucherItem);
}

async function getExportItems(voucherId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "export_vouchers", voucherId, "items"),
      where("is_deleted", "==", false),
    ),
  );
  return snapshot.docs.map((doc) => doc.data() as ExportVoucherItem);
}

function getMovementKey(dateKey: string, productId: string) {
  return `${dateKey}:${productId}`;
}

function getLocationMovementKey(
  dateKey: string,
  productId: string,
  locationId: string,
) {
  return `${dateKey}:${productId}:${locationId}`;
}

function getLocationProductKey(productId: string, locationId: string) {
  return `${productId}:${locationId}`;
}

function getOrCreateMovement(
  map: Map<string, MovementRecord>,
  dateKey: string,
  productId: string,
) {
  const key = getMovementKey(dateKey, productId);
  const existing = map.get(key);
  if (existing) return existing;

  const next: MovementRecord = {
    dateKey,
    productId,
    importQty: 0,
    exportQty: 0,
    importLocationIds: new Set<string>(),
    exportLocationIds: new Set<string>(),
    importVouchers: new Set<string>(),
    exportVouchers: new Set<string>(),
    unitPrice: null,
  };
  map.set(key, next);
  return next;
}

function getOrCreateLocationMovement(
  map: Map<string, MovementRecord>,
  dateKey: string,
  productId: string,
  locationId: string,
) {
  const key = getLocationMovementKey(dateKey, productId, locationId);
  const existing = map.get(key);
  if (existing) return existing;

  const next: MovementRecord = {
    dateKey,
    productId,
    importQty: 0,
    exportQty: 0,
    importLocationIds: new Set<string>([locationId]),
    exportLocationIds: new Set<string>([locationId]),
    importVouchers: new Set<string>(),
    exportVouchers: new Set<string>(),
    unitPrice: null,
  };
  map.set(key, next);
  return next;
}

function addQuantity(map: Map<string, number>, productId: string, delta: number) {
  map.set(productId, (map.get(productId) ?? 0) + delta);
}

function addLocationQuantity(
  map: Map<string, number>,
  productId: string,
  locationId: string,
  delta: number,
) {
  const key = getLocationProductKey(productId, locationId);
  map.set(key, (map.get(key) ?? 0) + delta);
}

function getDayKeys(startKey: string, endKey: string) {
  const days: string[] = [];
  for (let cursor = fromDayKey(startKey); toDayKey(cursor) <= endKey; cursor = addDays(cursor, 1)) {
    days.push(toDayKey(cursor));
  }
  return days;
}

function formatLocationList(
  ids: Set<string>,
  locationById: Map<string, WarehouseLocation>,
) {
  return Array.from(ids)
    .map((id) => {
      const location = locationById.get(id);
      return location ? `${location.code} - ${location.name}` : id;
    })
    .join(", ");
}

function isAll(value: string | undefined) {
  return !value || value === "all";
}

function hasProductFilter(options: ExportRequestOptions) {
  return Boolean(
    options.productSearch?.trim() ||
      !isAll(options.categoryId) ||
      !isAll(options.productType) ||
      !isAll(options.productOrigin) ||
      !isAll(options.serialized) ||
      !isAll(options.productUnit) ||
      !isAll(options.productMaterial),
  );
}

function buildSlotKey(locationId: string | null | undefined, productId: string) {
  return `${locationId ?? ""}:${productId}`;
}

function buildSlotMap(context: WarehouseExportContext) {
  return new Map(
    (context.slotMappings ?? [])
      .filter((mapping) => mapping.is_deleted !== true && mapping.is_active !== false)
      .map((mapping) => [
        buildSlotKey(mapping.warehouse_location_id, mapping.product_id),
        mapping.warehouse_location_slot_id,
      ]),
  );
}

function productMatchesFilters(
  product: Product | undefined,
  categoryById: Map<string, ProductCategory>,
  options: ExportRequestOptions,
) {
  if (!product) return !hasProductFilter(options);
  if (product.is_deleted) return false;

  const category = categoryById.get(product.category_id);
  const search = options.productSearch?.trim().toLowerCase() ?? "";
  if (search) {
    const haystack = [
      product.name,
      product.code,
      product.barcode,
      product.unit,
      product.product_material,
      product.product_origin,
      product.product_type,
      product.description,
      category?.name,
      category?.code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (!isAll(options.categoryId) && product.category_id !== options.categoryId) {
    return false;
  }
  if (!isAll(options.productType) && product.product_type !== options.productType) {
    return false;
  }
  if (
    !isAll(options.productOrigin) &&
    product.product_origin !== options.productOrigin
  ) {
    return false;
  }
  if (options.serialized === "serialized" && product.is_serialized !== true) {
    return false;
  }
  if (options.serialized === "standard" && product.is_serialized === true) {
    return false;
  }
  if (!isAll(options.productUnit) && product.unit !== options.productUnit) {
    return false;
  }
  if (
    !isAll(options.productMaterial) &&
    product.product_material !== options.productMaterial
  ) {
    return false;
  }

  return true;
}

function buildFilteredProductIds(
  context: WarehouseExportContext,
  options: ExportRequestOptions,
) {
  if (!hasProductFilter(options)) return null;

  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const ids = new Set<string>();

  for (const product of context.products) {
    if (productMatchesFilters(product, categoryById, options)) {
      ids.add(product.id);
    }
  }

  return ids;
}

function itemMatchesFilters(
  productId: string,
  locationId: string | null | undefined,
  productIds: Set<string> | null,
  slotByLocationProduct: Map<string, string>,
  options: ExportRequestOptions,
) {
  if (productIds && !productIds.has(productId)) return false;
  if (!isAll(options.locationId) && locationId !== options.locationId) {
    return false;
  }
  if (!isAll(options.slotId)) {
    const mappedSlotId = slotByLocationProduct.get(buildSlotKey(locationId, productId));
    if (mappedSlotId !== options.slotId) return false;
  }

  return true;
}

function getFilteredInventory(
  context: WarehouseExportContext,
  options: ExportRequestOptions = {},
  counterOnly = false,
) {
  const productIds = buildFilteredProductIds(context, options);
  const slotByLocationProduct = buildSlotMap(context);
  const locationById = new Map(context.locations.map((location) => [location.id, location]));

  return context.inventory.filter((item) => {
    if (item.warehouse_id !== context.warehouseId || item.is_deleted) return false;
    if (
      !itemMatchesFilters(
        item.product_id,
        item.warehouse_location_id,
        productIds,
        slotByLocationProduct,
        options,
      )
    ) {
      return false;
    }
    if (counterOnly) {
      if (
        !isAll(options.locationId) &&
        item.warehouse_location_id === options.locationId
      ) {
        return true;
      }
      return locationById.get(item.warehouse_location_id)?.type === LocationType.COUNTER;
    }
    return true;
  });
}

async function collectMovements(
  context: WarehouseExportContext,
  startKey: string,
  endKey: string,
  options: ExportRequestOptions = {},
) {
  const movementMap = new Map<string, MovementRecord>();
  const locationMovementMap = new Map<string, MovementRecord>();
  const afterEndDelta = new Map<string, number>();
  const afterEndLocationDelta = new Map<string, number>();
  const maxKey = toDayKey(new Date());
  const productIds = buildFilteredProductIds(context, options);
  const slotByLocationProduct = buildSlotMap(context);

  const importCandidates = context.importVouchers.filter((voucher) => {
    const dateKey = toDateKey(getVoucherDate(voucher));
    return (
      voucher.warehouse_id === context.warehouseId &&
      isEffectiveImport(voucher) &&
      dateKey >= startKey &&
      dateKey <= maxKey
    );
  });

  const exportCandidates = context.exportVouchers.filter((voucher) => {
    const dateKey = toDateKey(getVoucherDate(voucher));
    return (
      voucher.warehouse_id === context.warehouseId &&
      isEffectiveExport(voucher) &&
      dateKey >= startKey &&
      dateKey <= maxKey
    );
  });

  await Promise.all(
    importCandidates.map(async (voucher) => {
      const date = getVoucherDate(voucher);
      if (!date) return;
      const dateKey = toDayKey(date);
      const items = await getImportItems(voucher.id);

      for (const item of items) {
        if (
          !itemMatchesFilters(
            item.product_id,
            item.warehouse_location_id,
            productIds,
            slotByLocationProduct,
            options,
          )
        ) {
          continue;
        }
        const quantity = Number(item.actual_quantity || item.expected_quantity || 0);
        if (quantity <= 0) continue;
        if (dateKey > endKey) {
          addQuantity(afterEndDelta, item.product_id, quantity);
          if (item.warehouse_location_id) {
            addLocationQuantity(
              afterEndLocationDelta,
              item.product_id,
              item.warehouse_location_id,
              quantity,
            );
          }
          continue;
        }
        const movement = getOrCreateMovement(movementMap, dateKey, item.product_id);
        movement.importQty += quantity;
        if (item.warehouse_location_id) {
          movement.importLocationIds.add(item.warehouse_location_id);
          const locationMovement = getOrCreateLocationMovement(
            locationMovementMap,
            dateKey,
            item.product_id,
            item.warehouse_location_id,
          );
          locationMovement.importQty += quantity;
          locationMovement.importVouchers.add(voucher.voucher_number);
          locationMovement.unitPrice = item.unit_price ?? locationMovement.unitPrice;
        }
        movement.importVouchers.add(voucher.voucher_number);
        movement.unitPrice = item.unit_price ?? movement.unitPrice;
      }
    }),
  );

  await Promise.all(
    exportCandidates.map(async (voucher) => {
      const date = getVoucherDate(voucher);
      if (!date) return;
      const dateKey = toDayKey(date);
      const items = await getExportItems(voucher.id);

      for (const item of items) {
        if (
          !itemMatchesFilters(
            item.product_id,
            item.warehouse_location_id,
            productIds,
            slotByLocationProduct,
            options,
          )
        ) {
          continue;
        }
        const quantity = Number(item.picked_quantity || item.quantity || 0);
        if (quantity <= 0) continue;
        if (dateKey > endKey) {
          addQuantity(afterEndDelta, item.product_id, -quantity);
          if (item.warehouse_location_id) {
            addLocationQuantity(
              afterEndLocationDelta,
              item.product_id,
              item.warehouse_location_id,
              -quantity,
            );
          }
          continue;
        }
        const movement = getOrCreateMovement(movementMap, dateKey, item.product_id);
        movement.exportQty += quantity;
        if (item.warehouse_location_id) {
          movement.exportLocationIds.add(item.warehouse_location_id);
          const locationMovement = getOrCreateLocationMovement(
            locationMovementMap,
            dateKey,
            item.product_id,
            item.warehouse_location_id,
          );
          locationMovement.exportQty += quantity;
          locationMovement.exportVouchers.add(voucher.voucher_number);
          locationMovement.unitPrice = item.unit_price ?? locationMovement.unitPrice;
        }
        movement.exportVouchers.add(voucher.voucher_number);
        movement.unitPrice = item.unit_price ?? movement.unitPrice;
      }
    }),
  );

  return {
    movementMap,
    locationMovementMap,
    afterEndDelta,
    afterEndLocationDelta,
  };
}

function buildCurrentStockByProduct(
  context: WarehouseExportContext,
  options: ExportRequestOptions = {},
) {
  const stock = new Map<string, number>();
  for (const item of getFilteredInventory(context, options)) {
    addQuantity(stock, item.product_id, Number(item.total_quantity || 0));
  }
  return stock;
}

function buildCurrentStockByLocationProduct(
  context: WarehouseExportContext,
  options: ExportRequestOptions = {},
) {
  const stock = new Map<string, number>();
  for (const item of getFilteredInventory(context, options, true)) {
    const locationId = item.warehouse_location_id;
    if (!locationId) continue;
    addLocationQuantity(
      stock,
      item.product_id,
      locationId,
      Number(item.total_quantity || 0),
    );
  }
  return stock;
}

function buildInventoryRows(
  context: WarehouseExportContext,
  options: ExportRequestOptions = {},
) {
  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const locationById = new Map(context.locations.map((location) => [location.id, location]));
  const slotById = new Map((context.slots ?? []).map((slot) => [slot.id, slot]));
  const slotByLocationProduct = buildSlotMap(context);
  const rows = getFilteredInventory(context, options)
    .map((item) => {
      const product = productById.get(item.product_id);
      const category = product ? categoryById.get(product.category_id) : null;
      const location = locationById.get(item.warehouse_location_id);
      const slotId = slotByLocationProduct.get(
        buildSlotKey(item.warehouse_location_id, item.product_id),
      );
      const slot = slotId ? slotById.get(slotId) : null;
      return {
        product_code: product?.code ?? item.product_id,
        product_name: product?.name ?? item.product_id,
        category_name: category?.name ?? product?.category_id ?? "",
        product_type: product?.product_type ?? "",
        product_barcode: product?.barcode ?? "",
        location_code: location?.code ?? item.warehouse_location_id,
        location_name: location?.name ?? item.warehouse_location_id,
        slot_code: slot?.code ?? "",
        slot_name: slot?.name ?? "",
        warehouse_id: context.warehouseId,
        product_id: item.product_id,
        total_quantity: item.total_quantity,
        atp_quantity: item.atp_quantity,
        on_hold_quantity: item.on_hold_quantity,
        in_transit_quantity: item.in_transit_quantity,
        quarantine_quantity: item.quarantine_quantity,
        unit: product?.unit ?? "",
        unit_price: product?.unit_price ?? null,
      };
    })
    .sort((a, b) => a.product_code.localeCompare(b.product_code, "vi"));

  return rows;
}

export function buildWarehouseInventoryExportConfig(
  context: WarehouseExportContext,
  options: ExportRequestOptions = {},
): ExportConfig {
  const columns: ExcelColumnConfig[] = [
    { header: "Mã SP", key: "product_code", width: 18 },
    { header: "Tên sản phẩm", key: "product_name", width: 34 },
    { header: "Danh mục", key: "category_name", width: 24 },
    { header: "Loại SP", key: "product_type", width: 18 },
    { header: "Mã vạch", key: "product_barcode", width: 20 },
    { header: "Mã vị trí", key: "location_code", width: 18 },
    { header: "Vị trí", key: "location_name", width: 24 },
    { header: "Mã slot", key: "slot_code", width: 16 },
    { header: "Slot", key: "slot_name", width: 20 },
    { header: "Tổng số lượng", key: "total_quantity", width: 16 },
    { header: "Khả dụng (ATP)", key: "atp_quantity", width: 16 },
    { header: "Tạm giữ", key: "on_hold_quantity", width: 14 },
    { header: "Chờ xuất", key: "in_transit_quantity", width: 14 },
    { header: "Cách ly", key: "quarantine_quantity", width: 14 },
    { header: "Đơn vị", key: "unit", width: 12 },
  ];

  if (context.canViewPrice) {
    columns.push({ header: "Đơn giá", key: "unit_price", width: 16 });
  }

  columns.push(
    { header: "Warehouse ID", key: "warehouse_id", width: 35 },
    { header: "Product ID", key: "product_id", width: 35 },
  );

  return {
    filename: `inventory_${toFilenamePart(context.warehouseName)}`,
    entityType: "inventory",
    warehouseId: context.warehouseId,
    filters: { dataKind: "inventory", ...options },
    data: buildInventoryRows(context, options),
    columns,
  };
}

function buildDailySummaryExportConfig(
  context: WarehouseExportContext,
  movementMap: Map<string, MovementRecord>,
  afterEndDelta: Map<string, number>,
  startKey: string,
  endKey: string,
  label: string,
  options: ExportRequestOptions,
): ExportConfig {
  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const days = getDayKeys(startKey, endKey);
  const rowByProductId = new Map<string, Record<string, unknown>>();

  for (const record of movementMap.values()) {
    if (record.importQty <= 0 && record.exportQty <= 0) continue;

    const product = productById.get(record.productId);
    const category = product ? categoryById.get(product.category_id) : null;
    const row =
      rowByProductId.get(record.productId) ??
      {
        product_code: product?.code ?? record.productId,
        product_name: product?.name ?? record.productId,
        category_name: category?.name ?? product?.category_id ?? "",
        product_type: product?.product_type ?? "",
        product_barcode: product?.barcode ?? "",
        unit: product?.unit ?? "",
        unit_price: record.unitPrice ?? product?.unit_price ?? null,
        total_import_quantity: 0,
        total_export_quantity: 0,
        total_ending_quantity: 0,
        warehouse_id: context.warehouseId,
        product_id: record.productId,
      };

    const importKey = `${record.dateKey}_import`;
    const exportKey = `${record.dateKey}_export`;
    row[importKey] = Number(row[importKey] ?? 0) + record.importQty;
    row[exportKey] = Number(row[exportKey] ?? 0) + record.exportQty;
    row.total_import_quantity =
      Number(row.total_import_quantity ?? 0) + record.importQty;
    row.total_export_quantity =
      Number(row.total_export_quantity ?? 0) + record.exportQty;

    rowByProductId.set(record.productId, row);
  }

  const rows = Array.from(rowByProductId.values()).sort((a, b) =>
    String(a.product_code).localeCompare(String(b.product_code), "vi"),
  );
  for (const row of rows) {
    for (const day of days) {
      row[`${day}_import`] = row[`${day}_import`] ?? 0;
      row[`${day}_export`] = row[`${day}_export`] ?? 0;
    }
  }

  const stockByProduct = buildCurrentStockByProduct(context, options);
  for (const [productId, delta] of afterEndDelta.entries()) {
    stockByProduct.set(productId, (stockByProduct.get(productId) ?? 0) - delta);
  }

  const recordsByDayProduct = new Map(
    Array.from(movementMap.values()).map((record) => [
      getMovementKey(record.dateKey, record.productId),
      record,
    ]),
  );

  for (let cursor = fromDayKey(endKey); toDayKey(cursor) >= startKey; cursor = addDays(cursor, -1)) {
    const day = toDayKey(cursor);
    for (const row of rows) {
      const productId = String(row.product_id);
      const record = recordsByDayProduct.get(getMovementKey(day, productId));
      const endingStock = stockByProduct.get(productId) ?? 0;
      row[`${day}_stock`] = endingStock;
      if (day === endKey) {
        row.total_ending_quantity = endingStock;
      }
      stockByProduct.set(
        productId,
        endingStock - (record?.importQty ?? 0) + (record?.exportQty ?? 0),
      );
    }
  }

  const columns: ExcelColumnConfig[] = [
    { header: "Mã SP", key: "product_code", width: 18 },
    { header: "Tên sản phẩm", key: "product_name", width: 34 },
    { header: "Danh mục", key: "category_name", width: 24 },
    { header: "Loại SP", key: "product_type", width: 18 },
    { header: "Mã vạch", key: "product_barcode", width: 20 },
    { header: "Đơn vị", key: "unit", width: 12 },
  ];

  if (context.canViewPrice) {
    columns.push({ header: "Đơn giá", key: "unit_price", width: 16 });
  }

  for (const day of days) {
    columns.push(
      { header: "Nhập", key: `${day}_import`, width: 14 },
      { header: "Xuất", key: `${day}_export`, width: 14 },
      { header: "Tồn", key: `${day}_stock`, width: 14 },
    );
  }

  columns.push(
    { header: "Tổng nhập", key: "total_import_quantity", width: 14 },
    { header: "Tổng xuất", key: "total_export_quantity", width: 14 },
    { header: "Tổng tồn kho", key: "total_ending_quantity", width: 16 },
    { header: "Warehouse ID", key: "warehouse_id", width: 35 },
    { header: "Product ID", key: "product_id", width: 35 },
  );

  return {
    filename: `daily_summary_${toFilenamePart(context.warehouseName)}_${label}`,
    entityType: "inventory",
    warehouseId: context.warehouseId,
    filters: { dataKind: "dailySummary", ...options, startKey, endKey },
    data: rows,
    columns,
    columnGroups: days.map((day) => ({
      header: day,
      fromKey: `${day}_import`,
      toKey: `${day}_stock`,
    })),
  };
}

function buildCounterDailySummaryExportConfig(
  context: WarehouseExportContext,
  locationMovementMap: Map<string, MovementRecord>,
  afterEndLocationDelta: Map<string, number>,
  startKey: string,
  endKey: string,
  label: string,
  options: ExportRequestOptions,
): ExportConfig {
  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const locationById = new Map(context.locations.map((location) => [location.id, location]));
  const days = getDayKeys(startKey, endKey);
  const currentStock = buildCurrentStockByLocationProduct(context, options);

  for (const [key, delta] of afterEndLocationDelta.entries()) {
    currentStock.set(key, (currentStock.get(key) ?? 0) - delta);
  }

  const allowedLocationIds = new Set(
    context.locations
      .filter((location) => {
        if (location.type !== LocationType.COUNTER) return false;
        if (!isAll(options.locationId) && location.id !== options.locationId) {
          return false;
        }
        return true;
      })
      .map((location) => location.id),
  );
  if (!isAll(options.locationId)) {
    allowedLocationIds.add(options.locationId as string);
  }

  const rowKeys = new Set<string>();
  for (const key of currentStock.keys()) {
    const [, locationId] = key.split(":");
    if (allowedLocationIds.has(locationId)) rowKeys.add(key);
  }
  for (const record of locationMovementMap.values()) {
    const locationId =
      Array.from(record.importLocationIds)[0] ??
      Array.from(record.exportLocationIds)[0];
    if (!locationId || !allowedLocationIds.has(locationId)) continue;
    rowKeys.add(getLocationProductKey(record.productId, locationId));
  }

  const rows = Array.from(rowKeys)
    .map((key) => {
      const [productId, locationId] = key.split(":");
      const product = productById.get(productId);
      const category = product ? categoryById.get(product.category_id) : null;
      const location = locationById.get(locationId);

      return {
        location_code: location?.code ?? locationId,
        location_name: location?.name ?? locationId,
        product_code: product?.code ?? productId,
        product_name: product?.name ?? productId,
        category_name: category?.name ?? product?.category_id ?? "",
        product_type: product?.product_type ?? "",
        product_barcode: product?.barcode ?? "",
        unit: product?.unit ?? "",
        unit_price: product?.unit_price ?? null,
        total_import_quantity: 0,
        total_export_quantity: 0,
        total_ending_quantity: 0,
        warehouse_id: context.warehouseId,
        location_id: locationId,
        product_id: productId,
      } as Record<string, unknown>;
    })
    .sort((a, b) => {
      const locationCompare = String(a.location_code).localeCompare(
        String(b.location_code),
        "vi",
      );
      if (locationCompare !== 0) return locationCompare;
      return String(a.product_code).localeCompare(String(b.product_code), "vi");
    });

  const rowByLocationProduct = new Map(
    rows.map((row) => [
      getLocationProductKey(String(row.product_id), String(row.location_id)),
      row,
    ]),
  );

  for (const record of locationMovementMap.values()) {
    const locationId =
      Array.from(record.importLocationIds)[0] ??
      Array.from(record.exportLocationIds)[0];
    if (!locationId) continue;
    const row = rowByLocationProduct.get(
      getLocationProductKey(record.productId, locationId),
    );
    if (!row) continue;

    row[`${record.dateKey}_import`] =
      Number(row[`${record.dateKey}_import`] ?? 0) + record.importQty;
    row[`${record.dateKey}_export`] =
      Number(row[`${record.dateKey}_export`] ?? 0) + record.exportQty;
    row.total_import_quantity =
      Number(row.total_import_quantity ?? 0) + record.importQty;
    row.total_export_quantity =
      Number(row.total_export_quantity ?? 0) + record.exportQty;
    if (context.canViewPrice && !row.unit_price) {
      row.unit_price = record.unitPrice;
    }
  }

  for (let cursor = fromDayKey(endKey); toDayKey(cursor) >= startKey; cursor = addDays(cursor, -1)) {
    const day = toDayKey(cursor);
    for (const row of rows) {
      const productId = String(row.product_id);
      const locationId = String(row.location_id);
      const locationProductKey = getLocationProductKey(productId, locationId);
      const record = locationMovementMap.get(
        getLocationMovementKey(day, productId, locationId),
      );
      const endingStock = currentStock.get(locationProductKey) ?? 0;

      row[`${day}_import`] = row[`${day}_import`] ?? 0;
      row[`${day}_export`] = row[`${day}_export`] ?? 0;
      row[`${day}_stock`] = endingStock;
      if (day === endKey) {
        row.total_ending_quantity = endingStock;
      }
      currentStock.set(
        locationProductKey,
        endingStock - (record?.importQty ?? 0) + (record?.exportQty ?? 0),
      );
    }
  }

  const columns: ExcelColumnConfig[] = [
    { header: "Mã quầy", key: "location_code", width: 18 },
    { header: "Quầy", key: "location_name", width: 24 },
    { header: "Mã SP", key: "product_code", width: 18 },
    { header: "Tên sản phẩm", key: "product_name", width: 34 },
    { header: "Danh mục", key: "category_name", width: 24 },
    { header: "Loại SP", key: "product_type", width: 18 },
    { header: "Mã vạch", key: "product_barcode", width: 20 },
    { header: "Đơn vị", key: "unit", width: 12 },
  ];

  if (context.canViewPrice) {
    columns.push({ header: "Đơn giá", key: "unit_price", width: 16 });
  }

  for (const day of days) {
    columns.push(
      { header: "Nhập", key: `${day}_import`, width: 14 },
      { header: "Xuất", key: `${day}_export`, width: 14 },
      { header: "Tồn", key: `${day}_stock`, width: 14 },
    );
  }

  columns.push(
    { header: "Tổng nhập", key: "total_import_quantity", width: 14 },
    { header: "Tổng xuất", key: "total_export_quantity", width: 14 },
    { header: "Tổng tồn kho", key: "total_ending_quantity", width: 16 },
    { header: "Warehouse ID", key: "warehouse_id", width: 35 },
    { header: "Location ID", key: "location_id", width: 35 },
    { header: "Product ID", key: "product_id", width: 35 },
  );

  return {
    filename: `counter_daily_summary_${toFilenamePart(context.warehouseName)}_${label}`,
    entityType: "inventory",
    warehouseId: context.warehouseId,
    filters: { dataKind: "counterDailySummary", ...options, startKey, endKey },
    data: rows,
    columns,
    columnGroups: days.map((day) => ({
      header: day,
      fromKey: `${day}_import`,
      toKey: `${day}_stock`,
    })),
  };
}

export async function buildWarehouseMovementExportConfig(
  context: WarehouseExportContext,
  options: ExportRequestOptions,
): Promise<ExportConfig> {
  const dataKind = options.dataKind ?? "movement";
  if (!MOVEMENT_EXPORT_KINDS.has(dataKind)) {
    return buildWarehouseInventoryExportConfig(context, options);
  }

  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const locationById = new Map(context.locations.map((location) => [location.id, location]));
  const { startKey, endKey, label } = resolveRange(options);
  const {
    movementMap,
    locationMovementMap,
    afterEndDelta,
    afterEndLocationDelta,
  } = await collectMovements(
    context,
    startKey,
    endKey,
    options,
  );

  if (dataKind === "dailySummary") {
    return buildDailySummaryExportConfig(
      context,
      movementMap,
      afterEndDelta,
      startKey,
      endKey,
      label,
      options,
    );
  }

  if (dataKind === "counterDailySummary") {
    return buildCounterDailySummaryExportConfig(
      context,
      locationMovementMap,
      afterEndLocationDelta,
      startKey,
      endKey,
      label,
      options,
    );
  }

  const currentStock = buildCurrentStockByProduct(context, options);
  const closingStock = new Map(currentStock);

  for (const [productId, delta] of afterEndDelta.entries()) {
    closingStock.set(productId, (closingStock.get(productId) ?? 0) - delta);
  }

  const rows: Record<string, unknown>[] = [];
  for (let cursor = fromDayKey(endKey); toDayKey(cursor) >= startKey; cursor = addDays(cursor, -1)) {
    const dateKey = toDayKey(cursor);
    const records = Array.from(movementMap.values()).filter(
      (record) => record.dateKey === dateKey,
    );

    for (const record of records) {
      const product = productById.get(record.productId);
      const category = product ? categoryById.get(product.category_id) : null;
      const endingStock = closingStock.get(record.productId) ?? 0;
      const unitPrice = record.unitPrice ?? product?.unit_price ?? null;
      const shouldDisplay =
        dataKind === "movement" ||
        (dataKind === "imports" && record.importQty > 0) ||
        (dataKind === "exports" && record.exportQty > 0);

      if (shouldDisplay) {
        rows.push({
          date: dateKey,
          product_code: product?.code ?? record.productId,
          product_name: product?.name ?? record.productId,
          category_name: category?.name ?? product?.category_id ?? "",
          product_type: product?.product_type ?? "",
          product_barcode: product?.barcode ?? "",
          unit: product?.unit ?? "",
          unit_price: unitPrice,
          import_quantity: record.importQty,
          export_quantity: record.exportQty,
          ending_quantity: endingStock,
          import_locations: formatLocationList(record.importLocationIds, locationById),
          export_locations: formatLocationList(record.exportLocationIds, locationById),
          import_vouchers: Array.from(record.importVouchers).join(", "),
          export_vouchers: Array.from(record.exportVouchers).join(", "),
          warehouse_id: context.warehouseId,
          product_id: record.productId,
        });
      }

      closingStock.set(
        record.productId,
        endingStock - record.importQty + record.exportQty,
      );
    }
  }

  const columns: ExcelColumnConfig[] = [
    { header: "Ngày", key: "date", width: 14 },
    { header: "Mã SP", key: "product_code", width: 18 },
    { header: "Tên sản phẩm", key: "product_name", width: 34 },
    { header: "Danh mục", key: "category_name", width: 24 },
    { header: "Loại SP", key: "product_type", width: 18 },
    { header: "Mã vạch", key: "product_barcode", width: 20 },
    { header: "Đơn vị", key: "unit", width: 12 },
  ];

  if (context.canViewPrice) {
    columns.push({ header: "Đơn giá", key: "unit_price", width: 16 });
  }

  columns.push(
    { header: "Nhập", key: "import_quantity", width: 14 },
    { header: "Xuất", key: "export_quantity", width: 14 },
    { header: "Tồn cuối ngày", key: "ending_quantity", width: 16 },
    { header: "Vị trí nhập", key: "import_locations", width: 30 },
    { header: "Vị trí xuất", key: "export_locations", width: 30 },
    { header: "Phiếu nhập", key: "import_vouchers", width: 28 },
    { header: "Phiếu xuất", key: "export_vouchers", width: 28 },
    { header: "Warehouse ID", key: "warehouse_id", width: 35 },
    { header: "Product ID", key: "product_id", width: 35 },
  );

  const filenameKind =
    dataKind === "imports"
      ? "imports"
      : dataKind === "exports"
        ? "exports"
        : "movement";

  return {
    filename: `${filenameKind}_${toFilenamePart(context.warehouseName)}_${label}`,
    entityType: "inventory",
    warehouseId: context.warehouseId,
    filters: { dataKind, ...options, startKey, endKey },
    data: rows.reverse(),
    columns,
  };
}
