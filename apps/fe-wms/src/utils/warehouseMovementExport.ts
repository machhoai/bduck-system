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
} from "@bduck/shared-types";
import { ExportVoucherStatus, ImportVoucherStatus } from "@bduck/shared-types";
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
  importVouchers: ImportVoucher[];
  exportVouchers: ExportVoucher[];
  canViewPrice: boolean;
}

const MOVEMENT_EXPORT_KINDS = new Set<ExportDataKind>([
  "imports",
  "exports",
  "movement",
  "dailySummary",
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

function addQuantity(map: Map<string, number>, productId: string, delta: number) {
  map.set(productId, (map.get(productId) ?? 0) + delta);
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

async function collectMovements(
  context: WarehouseExportContext,
  startKey: string,
  endKey: string,
) {
  const movementMap = new Map<string, MovementRecord>();
  const afterEndDelta = new Map<string, number>();
  const maxKey = toDayKey(new Date());

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
        const quantity = Number(item.actual_quantity || item.expected_quantity || 0);
        if (quantity <= 0) continue;
        if (dateKey > endKey) {
          addQuantity(afterEndDelta, item.product_id, quantity);
          continue;
        }
        const movement = getOrCreateMovement(movementMap, dateKey, item.product_id);
        movement.importQty += quantity;
        if (item.warehouse_location_id) {
          movement.importLocationIds.add(item.warehouse_location_id);
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
        const quantity = Number(item.picked_quantity || item.quantity || 0);
        if (quantity <= 0) continue;
        if (dateKey > endKey) {
          addQuantity(afterEndDelta, item.product_id, -quantity);
          continue;
        }
        const movement = getOrCreateMovement(movementMap, dateKey, item.product_id);
        movement.exportQty += quantity;
        if (item.warehouse_location_id) {
          movement.exportLocationIds.add(item.warehouse_location_id);
        }
        movement.exportVouchers.add(voucher.voucher_number);
        movement.unitPrice = item.unit_price ?? movement.unitPrice;
      }
    }),
  );

  return { movementMap, afterEndDelta };
}

function buildCurrentStockByProduct(inventory: Inventory[], warehouseId: string) {
  const stock = new Map<string, number>();
  for (const item of inventory) {
    if (item.warehouse_id !== warehouseId || item.is_deleted) continue;
    addQuantity(stock, item.product_id, Number(item.total_quantity || 0));
  }
  return stock;
}

function buildInventoryRows(context: WarehouseExportContext) {
  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const locationById = new Map(context.locations.map((location) => [location.id, location]));
  const rows = context.inventory
    .filter((item) => item.warehouse_id === context.warehouseId && !item.is_deleted)
    .map((item) => {
      const product = productById.get(item.product_id);
      const category = product ? categoryById.get(product.category_id) : null;
      const location = locationById.get(item.warehouse_location_id);
      return {
        product_code: product?.code ?? item.product_id,
        product_name: product?.name ?? item.product_id,
        category_name: category?.name ?? product?.category_id ?? "",
        product_type: product?.product_type ?? "",
        product_barcode: product?.barcode ?? "",
        location_code: location?.code ?? item.warehouse_location_id,
        location_name: location?.name ?? item.warehouse_location_id,
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
): ExportConfig {
  const columns: ExcelColumnConfig[] = [
    { header: "Mã SP", key: "product_code", width: 18 },
    { header: "Tên sản phẩm", key: "product_name", width: 34 },
    { header: "Danh mục", key: "category_name", width: 24 },
    { header: "Loại SP", key: "product_type", width: 18 },
    { header: "Mã vạch", key: "product_barcode", width: 20 },
    { header: "Mã vị trí", key: "location_code", width: 18 },
    { header: "Vị trí", key: "location_name", width: 24 },
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
    data: buildInventoryRows(context),
    columns,
  };
}

function buildDailySummaryExportConfig(
  context: WarehouseExportContext,
  movementMap: Map<string, MovementRecord>,
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
    );
  }

  columns.push(
    { header: "Tổng nhập", key: "total_import_quantity", width: 14 },
    { header: "Tổng xuất", key: "total_export_quantity", width: 14 },
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
      toKey: `${day}_export`,
    })),
  };
}

export async function buildWarehouseMovementExportConfig(
  context: WarehouseExportContext,
  options: ExportRequestOptions,
): Promise<ExportConfig> {
  const dataKind = options.dataKind ?? "movement";
  if (!MOVEMENT_EXPORT_KINDS.has(dataKind)) {
    return buildWarehouseInventoryExportConfig(context);
  }

  const productById = new Map(context.products.map((product) => [product.id, product]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const locationById = new Map(context.locations.map((location) => [location.id, location]));
  const { startKey, endKey, label } = resolveRange(options);
  const { movementMap, afterEndDelta } = await collectMovements(
    context,
    startKey,
    endKey,
  );

  if (dataKind === "dailySummary") {
    return buildDailySummaryExportConfig(
      context,
      movementMap,
      startKey,
      endKey,
      label,
      options,
    );
  }

  const currentStock = buildCurrentStockByProduct(
    context.inventory,
    context.warehouseId,
  );
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
