"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Filter,
  Search,
  XCircle,
} from "lucide-react";
import type { ImportVoucher } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";
import VoucherDetailDrawer from "./VoucherDetailDrawer";

interface HistoryTabProps {
  vouchers: ImportVoucher[];
  onClone: (data: Record<string, unknown>) => void;
}

interface HistoryFilters {
  search: string;
  status: string;
  warehouse_id: string;
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

export default function HistoryTab({ vouchers, onClone }: HistoryTabProps) {
  const { t } = useTranslation();
  const importText = t.importVoucher as any;
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>({
    search: "",
    status: "",
    warehouse_id: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return vouchers.filter((v) => {
      if (
        filters.search &&
        !v.voucher_number.toLowerCase().includes(filters.search.toLowerCase()) &&
        !v.supplier_name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      if (filters.status && v.status !== filters.status) return false;
      if (filters.warehouse_id && v.warehouse_id !== filters.warehouse_id) {
        return false;
      }
      return true;
    });
  }, [vouchers, filters]);

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <Search size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          {importText.empty.history}
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
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value })
            }
            placeholder={importText.filter.searchPlaceholder}
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
          <div>
            <label className="mb-1 block text-xxs font-medium uppercase text-[var(--color-text-muted)]">
              {importText.filter.status}
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">{importText.filter.all}</option>
              <option value="COMPLETED">
                {t.importVoucher.status.COMPLETED}
              </option>
              <option value="REJECTED">{t.importVoucher.status.REJECTED}</option>
              <option value="CANCELLED">
                {t.importVoucher.status.CANCELLED}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xxs font-medium uppercase text-[var(--color-text-muted)]">
              {importText.filter.warehouse}
            </label>
            <input
              type="text"
              value={filters.warehouse_id}
              onChange={(e) =>
                setFilters({ ...filters, warehouse_id: e.target.value })
              }
              placeholder="ID"
              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters({ search: "", status: "", warehouse_id: "" })
              }
              className="text-xs text-[var(--color-brand-primary)] hover:underline"
            >
              {importText.filter.clearFilters}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        {filtered.length} {importText.filter.results}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          {importText.empty.noMatches}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((voucher) => {
            const isCompleted = voucher.status === "COMPLETED";
            const isRejected = voucher.status === "REJECTED";
            const statusIcon = isCompleted ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            );
            const statusColor = isCompleted
              ? "bg-emerald-50 text-[var(--color-accent-success)]"
              : isRejected
                ? "bg-amber-50 text-amber-600"
                : "bg-red-50 text-[var(--color-accent-error)]";
            const statusLabel =
              importText.status?.[voucher.status] ?? voucher.status;

            return (
              <div
                key={voucher.id}
                className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 transition-colors hover:bg-[var(--color-surface-card)]"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${statusColor}`}
                >
                  {statusIcon}
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
                    {voucher.supplier_name} / {voucher.warehouse_id}
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
                    title={importText.actions.viewDetail}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onClone({
                        warehouse_id: voucher.warehouse_id,
                        supplier_name: voucher.supplier_name,
                        purchase_order_id: voucher.purchase_order_id,
                        notes: voucher.notes,
                      })
                    }
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-brand-primary-muted)] hover:text-[var(--color-brand-primary)]"
                    title={importText.actions.clone}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId &&
        (() => {
          const selected = vouchers.find((v) => v.id === selectedId);
          if (!selected) return null;
          return (
            <VoucherDetailDrawer
              voucher={selected}
              onClose={() => setSelectedId(null)}
            />
          );
        })()}
    </div>
  );
}
