"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, History, ShieldCheck } from "lucide-react";
import type { NonconformityReport } from "@bduck/shared-types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import NonconformityResolveDrawer from "@/components/tasks/NonconformityResolveDrawer";
import { useNonconformities } from "@/hooks/useNonconformities";
import { useProducts } from "@/hooks/useProducts";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";

interface WarehouseDiscrepancyHistoryProps {
  warehouseId: string;
  mode?: "panel" | "sheet";
  isOpen?: boolean;
  onClose?: () => void;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    const timestamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof timestamp.toDate === "function") return timestamp.toDate();
    if (typeof timestamp.seconds === "number") return new Date(timestamp.seconds * 1000);
    if (typeof timestamp._seconds === "number") return new Date(timestamp._seconds * 1000);
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(value: unknown) {
  const date = toDate(value);
  if (!date) return "unknown";
  return date.toISOString().slice(0, 10);
}

function formatDate(value: unknown) {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sourceLabel(source: string) {
  if (source === "STOCK_COUNT") return "Kiem dem";
  if (source === "IMPORT") return "Kiem dem nhap";
  if (source === "EXPORT") return "Kiem dem xuat";
  if (source === "TRANSFER") return "Dieu chuyen";
  return source;
}

export function WarehouseDiscrepancyHistory({
  warehouseId,
  mode = "panel",
  isOpen = true,
  onClose,
}: WarehouseDiscrepancyHistoryProps) {
  const { lang } = useTranslation();
  const { reports, loading } = useNonconformities();
  const { products } = useProducts();
  const { users } = useUsers();
  const { warehouses } = useWarehouses();
  const { locations } = useWarehouseLocations(warehouseId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<NonconformityReport | null>(null);

  const text = lang === "zh"
    ? {
        title: "差异历史",
        subtitle: "按日期、柜台和商品追踪盘点差异。",
        empty: "暂无差异记录",
        total: "差异",
        open: "未处理",
        resolved: "已处理",
        qty: "数量",
        source: "来源",
        reporter: "报告人",
        resolver: "处理人",
        method: "处理方式",
        status: "状态",
        detail: "查看明细",
      }
    : {
        title: "Lich su chenh lech",
        subtitle: "Theo doi chenh lech theo ngay, quay va ma hang.",
        empty: "Chua co lich su chenh lech",
        total: "Chenh lech",
        open: "Chua xu ly",
        resolved: "Da xu ly",
        qty: "So luong",
        source: "Nguon",
        reporter: "Bao cao boi",
        resolver: "Xu ly boi",
        method: "Phuong thuc",
        status: "Tinh trang",
        detail: "Xem chi tiet",
      };

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const warehouse = warehouses.find((item) => item.id === warehouseId);

  const scopedReports = useMemo(
    () => reports.filter((report) => report.warehouse_id === warehouseId),
    [reports, warehouseId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, NonconformityReport[]>();
    scopedReports.forEach((report) => {
      const key = dateKey(report.created_at);
      map.set(key, [...(map.get(key) ?? []), report]);
    });
    return [...map.entries()]
      .map(([key, rows]) => ({
        key,
        rows,
        totalQty: rows.reduce((sum, row) => sum + Math.abs(row.quantity_affected || 0), 0),
        locations: new Set(rows.map((row) => row.warehouse_location_id)).size,
        open: rows.filter((row) => row.status !== "RESOLVED" && row.status !== "CLOSED").length,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [scopedReports]);

  const activeDate = selectedDate || groups[0]?.key || null;
  const activeRows = activeDate ? groups.find((group) => group.key === activeDate)?.rows ?? [] : [];
  const resolvedCount = scopedReports.filter((report) => report.status === "RESOLVED" || report.status === "CLOSED").length;
  const openCount = scopedReports.length - resolvedCount;

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-3 py-3">
      <div className="hidden lg:block">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--color-brand-primary)]" />
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">{text.title}</h3>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{text.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label={text.total} value={scopedReports.length} />
        <Metric label={text.open} value={openCount} tone="warn" />
        <Metric label={text.resolved} value={resolvedCount} tone="ok" />
      </div>

      {loading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
          ))}
        </div>
      ) : scopedReports.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-center text-sm text-[var(--color-text-muted)]">
          <ShieldCheck className="h-9 w-9 text-[var(--color-neutral-300)]" />
          <p className="mt-2 font-semibold">{text.empty}</p>
        </div>
      ) : (
        <div className="grid min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="grid max-h-72 gap-2 overflow-y-auto lg:max-h-[360px]">
            {groups.map((group, index) => (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelectedDate(group.key)}
                className={`rounded-lg border p-3 text-left ${
                  activeDate === group.key
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                    : "border-[var(--color-border-subtle)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatDate(group.key)}</p>
                  <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label={text.qty} value={group.totalQty} />
                  <Mini label="Quay" value={group.locations} />
                  <Mini label={text.open} value={group.open} />
                </div>
                {index < 4 && (
                  <div className="mt-3 flex items-end gap-1">
                    {groups.slice(0, 8).map((bar, barIndex) => (
                      <div
                        key={bar.key}
                        className={`flex-1 rounded-t bg-[var(--color-brand-primary)] opacity-60 ${
                          ["h-2", "h-4", "h-6", "h-8", "h-10"][Math.min(4, Math.floor((bar.totalQty + barIndex) / 2))]
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="grid max-h-[520px] gap-2 overflow-y-auto">
            {activeRows.map((report) => {
              const product = productById.get(report.product_id);
              const location = locationById.get(report.warehouse_location_id);
              const reporter = userById.get(report.reporter_id);
              const resolver = report.resolved_by ? userById.get(report.resolved_by) : null;
              const diff =
                typeof report.actual_quantity === "number" && typeof report.expected_quantity === "number"
                  ? report.actual_quantity - report.expected_quantity
                  : report.quantity_affected;
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-3 text-left transition-colors hover:bg-[var(--color-neutral-50)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {location?.code || report.warehouse_location_id} - {product?.code || report.product_id}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{product?.name || "-"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${diff === 0 ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">
                    <Info label={text.source} value={`${sourceLabel(report.source_type)} ${report.source_id ? `#${String(report.source_id).slice(0, 8)}` : ""}`} />
                    <Info label={text.reporter} value={reporter?.full_name || reporter?.email || report.reporter_id} />
                    <Info label={text.status} value={report.status} />
                    <Info label={text.method} value={report.resolution_type || "-"} />
                    <Info label={text.resolver} value={resolver?.full_name || resolver?.email || report.resolved_by || "-"} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedReport && (
        <NonconformityResolveDrawer
          report={selectedReport}
          productName={productById.get(selectedReport.product_id)?.name || selectedReport.product_id}
          warehouseName={warehouse?.name || warehouseId}
          locationName={locationById.get(selectedReport.warehouse_location_id)?.name}
          reporterName={userById.get(selectedReport.reporter_id)?.full_name || selectedReport.reporter_id}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );

  if (mode === "sheet") {
    return (
      <BottomSheet title={text.title} isOpen={isOpen} onClose={onClose} defaultSnap="full">
        {content}
      </BottomSheet>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
      {content}
    </section>
  );
}

export function WarehouseDiscrepancyHistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full aspect-square flex justify-center items-center bg-white border border-[var(--color-border-subtle)] p-1.5 text-slate-600 shadow-sm active:scale-95 transition-all"
      title="Lich su chenh lech"
    >
      <AlertTriangle size={18} />
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-3 py-2">
      <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "ok" ? "text-[var(--color-success-text)]" : tone === "warn" ? "text-[var(--color-warning-text)]" : "text-[var(--color-text-primary)]"}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/70 px-2 py-1">
      <p className="text-xxs text-[var(--color-text-muted)]">{label}</p>
      <p className="font-bold text-[var(--color-text-primary)]">{value.toLocaleString()}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="truncate">
      <span className="text-[var(--color-text-muted)]">{label}: </span>
      <span className="font-semibold text-[var(--color-text-primary)]">{value}</span>
    </p>
  );
}
