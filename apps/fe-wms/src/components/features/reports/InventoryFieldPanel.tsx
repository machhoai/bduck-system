"use client";

import type {
  InventoryReportQuantityBucket,
  ReportDateMode,
  ReportFieldInstance,
} from "@bduck/shared-types";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useWarehouses } from "@/hooks/useWarehouses";

interface Props {
  disabled: boolean;
  onAddField: (field: ReportFieldInstance) => void;
}

const bucketOptions: InventoryReportQuantityBucket[] = [
  "total_quantity",
  "atp_quantity",
  "on_hold_quantity",
  "in_transit_quantity",
  "quarantine_quantity",
];

const dateModes: ReportDateMode[] = ["today", "specific_date"];

export default function InventoryFieldPanel({ disabled, onAddField }: Props) {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const [productCode, setProductCode] = useState("");
  const [warehouseScope, setWarehouseScope] = useState<
    "all_accessible" | "specific_warehouse"
  >("all_accessible");
  const [warehouseId, setWarehouseId] = useState("");
  const [bucket, setBucket] =
    useState<InventoryReportQuantityBucket>("total_quantity");
  const [dateMode, setDateMode] = useState<ReportDateMode>("today");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const selectedProduct = useMemo(
    () => products.find((product) => product.code === productCode),
    [productCode, products],
  );

  const handleAdd = () => {
    if (!productCode || disabled) return;
    const labelDate = dateMode === "today" ? "hôm nay" : date;
    onAddField({
      id: `fld_${Date.now()}`,
      field_key: "inventory.stock_by_product",
      label: `Tồn ${productCode} ${labelDate}`,
      params: {
        product_id: selectedProduct?.id,
        product_code: productCode,
        warehouse_scope: warehouseScope,
        warehouse_id: warehouseScope === "specific_warehouse" ? warehouseId : null,
        quantity_bucket: bucket,
        date_mode: dateMode,
        date: dateMode === "specific_date" ? date : null,
        output_format: "number",
      },
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-[var(--color-border-subtle)] bg-white p-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Trường tồn kho
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Tạo field rồi gán vào ô đang chọn.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Mã sản phẩm
        <select
          value={productCode}
          onChange={(event) => setProductCode(event.target.value)}
          className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
        >
          <option value="">Chọn mã hàng</option>
          {products.map((product) => (
            <option key={product.id} value={product.code}>
              {product.code} - {product.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Kho
        <select
          value={warehouseScope}
          onChange={(event) =>
            setWarehouseScope(event.target.value as "all_accessible" | "specific_warehouse")
          }
          className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
        >
          <option value="all_accessible">Tất cả kho được phép</option>
          <option value="specific_warehouse">Một kho cụ thể</option>
        </select>
      </label>
      {warehouseScope === "specific_warehouse" && (
        <select
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
        >
          <option value="">Chọn kho</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </select>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium">
        Loại tồn
        <select
          value={bucket}
          onChange={(event) =>
            setBucket(event.target.value as InventoryReportQuantityBucket)
          }
          className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
        >
          {bucketOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Phạm vi ngày
        <select
          value={dateMode}
          onChange={(event) => setDateMode(event.target.value as ReportDateMode)}
          className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
        >
          {dateModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode === "today" ? "Hôm nay" : "Ngày cụ thể"}
            </option>
          ))}
        </select>
      </label>
      {dateMode === "specific_date" && (
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-8 border border-[var(--color-border-subtle)] px-2 text-sm"
        />
      )}
      <button
        type="button"
        disabled={disabled || !productCode}
        onClick={handleAdd}
        className="flex h-8 w-fit items-center gap-1 bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Plus size={14} />
        Gán vào ô
      </button>
    </div>
  );
}
