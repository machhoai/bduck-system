import type {
  Inventory,
  InventoryStockByProductParams,
  Product,
  ReportFieldInstance,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import * as inventoryRepo from "../repositories/inventoryRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import {
  canReadWarehouse,
  getAccessibleWarehouseIds,
  type RequestUserContext,
} from "./warehouseAccess.js";

export interface ResolvedReportField {
  fieldInstanceId: string;
  value: string | number;
}

function assertCurrentStockOnly(params: InventoryStockByProductParams): void {
  if (params.date_mode === "today") return;
  throw {
    statusCode: 400,
    messages: {
      vi: "Trường tồn kho theo ngày quá khứ/tháng/năm cần dữ liệu snapshot. Giai đoạn này chỉ hỗ trợ tồn hiện tại.",
      zh: "历史日期/月/年的库存字段需要快照数据。当前阶段仅支持当前库存。",
    },
  };
}

async function findProduct(params: InventoryStockByProductParams): Promise<Product> {
  if (params.product_id) {
    const snap = await db.collection("products").doc(params.product_id).get();
    if (snap.exists) {
      const product = snap.data() as Product;
      if (!product.is_deleted) return product;
    }
  }

  const product = await productRepository.findByCode(params.product_code);
  if (!product) {
    throw {
      statusCode: 404,
      messages: {
        vi: `Không tìm thấy sản phẩm mã ${params.product_code}.`,
        zh: `未找到产品编码 ${params.product_code}。`,
      },
    };
  }
  return product;
}

function filterByPermission(
  records: Inventory[],
  params: InventoryStockByProductParams,
  user: RequestUserContext,
): Inventory[] {
  if (params.warehouse_scope === "specific_warehouse") {
    const warehouseId = params.warehouse_id || "";
    if (!warehouseId || !canReadWarehouse(user, warehouseId)) {
      throw {
        statusCode: 403,
        messages: {
          vi: "Bạn không có quyền xem tồn kho của kho đã chọn.",
          zh: "您无权查看所选仓库的库存。",
        },
      };
    }
    return records.filter((record) => record.warehouse_id === warehouseId);
  }

  const accessibleWarehouseIds = getAccessibleWarehouseIds(user);
  if (!accessibleWarehouseIds) return records;
  return records.filter((record) =>
    accessibleWarehouseIds.includes(record.warehouse_id),
  );
}

function formatStockValue(
  total: number,
  product: Product,
  records: Inventory[],
  params: InventoryStockByProductParams,
): string | number {
  if (params.output_format === "number") return total;
  if (params.output_format === "with_unit") return `${total} ${product.unit}`;
  return records
    .map(
      (record) =>
        `${record.warehouse_id}: ${record[params.quantity_bucket]} ${product.unit}`,
    )
    .join("; ");
}

async function resolveInventoryStockByProduct(
  instance: ReportFieldInstance,
  user: RequestUserContext,
): Promise<ResolvedReportField> {
  const params = instance.params;
  assertCurrentStockOnly(params);
  const product = await findProduct(params);
  const records = await inventoryRepo.findByProduct(product.id);
  const allowedRecords = filterByPermission(records, params, user);
  const total = allowedRecords.reduce(
    (sum, record) => sum + Number(record[params.quantity_bucket] || 0),
    0,
  );

  return {
    fieldInstanceId: instance.id,
    value: formatStockValue(total, product, allowedRecords, params),
  };
}

export async function resolveReportFieldInstances(
  instances: ReportFieldInstance[],
  user: RequestUserContext,
): Promise<Map<string, string | number>> {
  const entries = await Promise.all(
    instances.map(async (instance) => {
      if (instance.field_key === "inventory.stock_by_product") {
        const resolved = await resolveInventoryStockByProduct(instance, user);
        return [resolved.fieldInstanceId, resolved.value] as const;
      }
      throw {
        statusCode: 400,
        messages: {
          vi: "Trường dữ liệu báo cáo chưa được hỗ trợ.",
          zh: "尚不支持该报表数据字段。",
        },
      };
    }),
  );

  return new Map(entries);
}
