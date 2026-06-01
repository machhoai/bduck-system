"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Package, PackageMinus, X } from "lucide-react";
import type { ExportVoucher, ExportVoucherItem } from "@bduck/shared-types";
import { fetchExportVoucherById } from "../../../hooks/useExportVoucherApi";
import { useProducts } from "../../../hooks/useProducts";
import { useWarehouses } from "../../../hooks/useWarehouses";

interface ExportVoucherDetailDrawerProps {
  voucherId: string;
  onClose: () => void;
}

interface ExportVoucherDetail {
  voucher: ExportVoucher;
  items: ExportVoucherItem[];
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date =
    typeof value === "string"
      ? new Date(value)
      : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExportVoucherDetailDrawer({
  voucherId,
  onClose,
}: ExportVoucherDetailDrawerProps) {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const [detail, setDetail] = useState<ExportVoucherDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setError(null);

    fetchExportVoucherById(voucherId)
      .then((data) => {
        if (!disposed) setDetail(data as ExportVoucherDetail);
      })
      .catch((fetchError) => {
        if (!disposed) {
          console.error("[ExportVoucherDetailDrawer] load error:", fetchError);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Không thể tải chi tiết phiếu xuất.",
          );
        }
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [voucherId]);

  const voucher = detail?.voucher;
  const warehouse = voucher ? warehouseById.get(voucher.warehouse_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-orange-50 text-orange-700">
              <PackageMinus size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Chi tiết phiếu xuất
              </p>
              <h2 className="truncate text-lg font-bold text-[var(--color-text-primary)]">
                {voucher?.voucher_number ?? voucherId}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[var(--radius-md)] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : voucher ? (
            <div className="space-y-4">
              <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText size={17} className="text-orange-700" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Thông tin chung
                  </h3>
                </div>
                <div className="divide-y divide-[var(--color-border-soft)] text-sm">
                  <InfoRow label="Trạng thái" value={voucher.status} />
                  <InfoRow label="Loại xuất" value={voucher.export_type} />
                  <InfoRow
                    label="Kho xuất"
                    value={warehouse?.name ?? voucher.warehouse_id}
                  />
                  <InfoRow
                    label="Người nhận"
                    value={voucher.recipient_name || "-"}
                  />
                  <InfoRow
                    label="Bộ phận / kho đích"
                    value={voucher.recipient_department || "-"}
                  />
                  <InfoRow label="Ngày tạo" value={formatDate(voucher.created_at)} />
                  <InfoRow label="Ghi chú" value={voucher.notes || "-"} />
                </div>
              </section>

              <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package size={17} className="text-orange-700" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Danh sách hàng hóa
                    </h3>
                  </div>
                  <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                    {detail?.items.length ?? 0}
                  </span>
                </div>

                {detail?.items.length ? (
                  <div className="space-y-2">
                    {detail.items.map((item, index) => {
                      const product = productById.get(item.product_id);
                      return (
                        <div
                          key={item.id || `${item.product_id}-${index}`}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {product?.name ?? item.product_id}
                              </p>
                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                {product?.code ?? item.product_id}
                              </p>
                            </div>
                            <div className="text-right text-xs text-[var(--color-text-muted)]">
                              <p>SL: {item.quantity}</p>
                              <p>Đã soạn: {item.picked_quantity || 0}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] py-8 text-center text-sm text-[var(--color-text-muted)]">
                    Chưa có hàng hóa.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}
