"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Filter,
  PackageMinus,
  Search,
  XCircle,
} from "lucide-react";
import type { ExportVoucher } from "@bduck/shared-types";
import { ExportVoucherStatus } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";
import ExportVoucherDetailDrawer from "./ExportVoucherDetailDrawer";

interface Props {
  vouchers: ExportVoucher[];
  onClone: (data: Record<string, unknown>) => void;
}

interface HistoryFilters {
  search: string;
  status: string;
  warehouse_id: string;
}

function getClonePayload(voucher: ExportVoucher) {
  return {
    warehouse_id: voucher.warehouse_id,
    export_type: voucher.export_type,
    recipient_name: voucher.recipient_name,
    recipient_department: voucher.recipient_department,
    destination_warehouse_id: voucher.recipient_department,
    reference_id: voucher.reference_id,
    reference_type: voucher.reference_type,
    notes: voucher.notes,
  };
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date =
    typeof value === "string"
      ? new Date(value)
      : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

export default function ExportHistoryTab({ vouchers, onClone }: Props) {
  const { t } = useTranslation();
  const exportText = t.exportVoucher as any;
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({
    search: "",
    status: "",
    warehouse_id: "",
  });

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const searchable = [
        voucher.voucher_number,
        voucher.recipient_name,
        voucher.recipient_department,
        voucher.export_type,
        voucher.warehouse_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !searchable.includes(search)) return false;
      if (filters.status && voucher.status !== filters.status) return false;
      if (filters.warehouse_id && voucher.warehouse_id !== filters.warehouse_id) {
        return false;
      }
      return true;
    });
  }, [filters, vouchers]);

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <PackageMinus size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          {exportText.historyEmpty}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder={exportText.historySearchPlaceholder}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] py-2 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--color-border-focus)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
        >
          <Filter size={12} />
          {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xxs font-medium uppercase text-[var(--color-text-muted)]">
              {exportText.filter.status}
            </span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">{exportText.filter.all}</option>
              <option value="COMPLETED">
                {t.exportVoucher.status.COMPLETED}
              </option>
              <option value="CANCELLED">
                {t.exportVoucher.status.CANCELLED}
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xxs font-medium uppercase text-[var(--color-text-muted)]">
              {exportText.filter.warehouse}
            </span>
            <input
              type="text"
              value={filters.warehouse_id}
              onChange={(event) =>
                setFilters({ ...filters, warehouse_id: event.target.value })
              }
              placeholder="ID"
              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters({ search: "", status: "", warehouse_id: "" })
              }
              className="text-xs text-orange-700 hover:underline"
            >
              {exportText.filter.clearFilters}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        {filtered.length} {exportText.filter.results}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          {exportText.filter.noMatches}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((voucher) => {
            const isCompleted = voucher.status === ExportVoucherStatus.COMPLETED;
            const statusColor = isCompleted
              ? "bg-emerald-50 text-[var(--color-accent-success)]"
              : "bg-gray-100 text-[var(--color-text-muted)]";
            const statusLabel =
              exportText.status?.[voucher.status] ?? voucher.status;

            return (
              <div
                key={voucher.id}
                className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 transition-colors hover:bg-[var(--color-surface-card)]"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${statusColor}`}
                >
                  {isCompleted ? <CheckCircle size={16} /> : <XCircle size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      {voucher.voucher_number}
                    </p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-micro font-medium ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {voucher.recipient_name || voucher.export_type} /{" "}
                    {voucher.warehouse_id}
                  </p>
                </div>

                <p className="hidden shrink-0 text-xxs tabular-nums text-[var(--color-text-muted)] sm:block">
                  {formatDate(voucher.created_at)}
                </p>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(voucher.id)}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                    title={exportText.actions.viewDetail}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClone(getClonePayload(voucher))}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-orange-50 hover:text-orange-700"
                    title={exportText.actions.clone}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <ExportVoucherDetailDrawer
          voucherId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
