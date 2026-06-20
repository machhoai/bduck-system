"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Eye,
  Inbox,
  Package,
  Scale,
  ShieldAlert,
  User,
  Warehouse,
} from "lucide-react";
import type { NonconformityReport } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useProducts } from "@/hooks/useProducts";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { isActionableNonconformity } from "@/hooks/useNonconformities";
import { getStatusStyle } from "@/components/ui/StatusBadge";
import NonconformityResolveDrawer from "./NonconformityResolveDrawer";

interface NonconformityTaskTabProps {
  reports: NonconformityReport[];
  loading: boolean;
  initialReportId?: string | null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if ((value as { seconds?: number }).seconds !== undefined) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if ((value as { _seconds?: number })._seconds !== undefined) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NonconformitySkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
      <div className="h-4 w-36 rounded bg-[var(--color-skeleton-base)]" />
      <div className="mt-3 h-3 w-48 rounded bg-[var(--color-neutral-100)]" />
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="h-8 rounded bg-[var(--color-neutral-100)]" />
        <div className="h-8 rounded bg-[var(--color-neutral-100)]" />
        <div className="h-8 rounded bg-[var(--color-neutral-100)]" />
      </div>
    </div>
  );
}

export default function NonconformityTaskTab({
  reports,
  loading,
  initialReportId,
}: NonconformityTaskTabProps) {
  const { t } = useTranslation();
  const { products } = useProducts();
  const { warehouses } = useWarehouses();
  const { users } = useUsers();
  const [selectedReport, setSelectedReport] =
    useState<NonconformityReport | null>(null);

  const copy = t.tasks.nonconformity;
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  const actionableReports = useMemo(
    () => reports.filter((report) => isActionableNonconformity(report.status)),
    [reports],
  );

  useEffect(() => {
    if (loading || !initialReportId || selectedReport?.id === initialReportId) {
      return;
    }
    const target = reports.find((report) => report.id === initialReportId);
    if (target) setSelectedReport(target);
  }, [initialReportId, loading, reports, selectedReport?.id]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <NonconformitySkeleton key={index} />
        ))}
      </div>
    );
  }

  if (actionableReports.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-neutral-50)]">
          <Inbox className="h-7 w-7 text-[var(--color-neutral-300)]" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">
          {copy.emptyTitle}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {copy.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {actionableReports.map((report) => {
          const product = productById.get(report.product_id);
          const warehouse = warehouseById.get(report.warehouse_id);
          const reporter = userById.get(report.reporter_id);
          const issueLabel =
            copy.issueType[report.issue_type as keyof typeof copy.issueType] ||
            report.issue_type;
          const statusLabel =
            copy.status[report.status as keyof typeof copy.status] ||
            report.status;
          const statusColor = getStatusStyle(report.status);

          return (
            <article
              key={report.id}
              className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm transition-all hover:border-[var(--color-error-border)] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 aspect-square shrink-0 items-center justify-center rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error-text)] ring-1 ring-[var(--color-error-border)]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                      {issueLabel}
                    </p>
                    <h3 className="mt-1 truncate text-base font-bold text-[var(--color-text-primary)]">
                      {report.report_number}
                    </h3>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                  <span className="truncate">
                    {product?.name || report.product_id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Warehouse className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                  <span className="truncate">
                    {warehouse?.name || report.warehouse_id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                    <span>{report.quantity_affected.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                    <span className="truncate">{formatDate(report.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                  <span className="truncate">
                    {reporter?.full_name || reporter?.email || report.reporter_id}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border-soft)] pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-error-text)]">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{copy.lockedStock}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-[var(--color-text-on-dark)] transition-colors hover:opacity-90"
                >
                  <Eye className="h-4 w-4" />
                  {copy.openDetail}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selectedReport && (
        <NonconformityResolveDrawer
          report={selectedReport}
          productName={productById.get(selectedReport.product_id)?.name || selectedReport.product_id}
          warehouseName={warehouseById.get(selectedReport.warehouse_id)?.name || selectedReport.warehouse_id}
          reporterName={
            userById.get(selectedReport.reporter_id)?.full_name ||
            userById.get(selectedReport.reporter_id)?.email ||
            selectedReport.reporter_id
          }
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  );
}
