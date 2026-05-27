"use client";

/**
 * HistoryTab — Lịch sử lệnh nhập kho (COMPLETED / CANCELLED)
 *
 * Features:
 * - Collapsible filter bar (creator, status, approver, date range, warehouse, voucher_number)
 * - Table/list of completed vouchers
 * - Click row → VoucherDetailDrawer (TODO: sẽ build riêng)
 *
 * LUẬT THÉP:
 * - Realtime data (onSnapshot driven)
 * - i18n for all text
 * - Skeleton loading is handled by parent
 */

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
} from "lucide-react";
import type { ImportVoucher } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface HistoryTabProps {
  vouchers: ImportVoucher[];
  onClone: (data: Record<string, unknown>) => void;
}

interface HistoryFilters {
  search: string;
  status: string;
  warehouse_id: string;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function HistoryTab({ vouchers, onClone }: HistoryTabProps) {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>({
    search: "",
    status: "",
    warehouse_id: "",
  });

  // ── Client-side filtering ──
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
      if (filters.warehouse_id && v.warehouse_id !== filters.warehouse_id)
        return false;
      return true;
    });
  }, [vouchers, filters]);

  // ── Empty state ──
  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <Search size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          {(t as any).importVoucher?.empty?.history ?? "Chưa có lịch sử nhập kho"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Search + Filter toggle ── */}
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
            placeholder={
              (t as any).importVoucher?.filter?.searchPlaceholder ??
              "Tìm theo mã phiếu, NCC..."
            }
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

      {/* ── Expandable Filters ── */}
      {showFilters && (
        <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
              Trạng thái
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">Tất cả</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
              Kho nhận
            </label>
            <input
              type="text"
              value={filters.warehouse_id}
              onChange={(e) =>
                setFilters({ ...filters, warehouse_id: e.target.value })
              }
              placeholder="ID kho..."
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
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      <p className="text-xs text-[var(--color-text-muted)]">
        {filtered.length} kết quả
      </p>

      {/* ── Voucher list ── */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          Không tìm thấy phiếu nào phù hợp.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((voucher) => {
            const isCompleted = voucher.status === "COMPLETED";

            return (
              <div
                key={voucher.id}
                className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 transition-colors hover:bg-[var(--color-surface-card)]"
              >
                {/* Status icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isCompleted
                      ? "bg-emerald-50 text-[var(--color-accent-success)]"
                      : "bg-red-50 text-[var(--color-accent-error)]"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      {voucher.voucher_number}
                    </p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        isCompleted
                          ? "bg-emerald-50 text-[var(--color-accent-success)]"
                          : "bg-red-50 text-[var(--color-accent-error)]"
                      }`}
                    >
                      {isCompleted ? "Hoàn thành" : "Đã hủy"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {voucher.supplier_name} · {voucher.warehouse_id}
                  </p>
                </div>

                {/* Date */}
                <p className="hidden shrink-0 text-[10px] tabular-nums text-[var(--color-text-muted)] sm:block">
                  {voucher.created_at
                    ? new Date(
                        typeof voucher.created_at === "string"
                          ? voucher.created_at
                          : (voucher.created_at as any)?.toDate?.() ??
                              voucher.created_at,
                      ).toLocaleDateString("vi-VN")
                    : ""}
                </p>

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                    title="Xem chi tiết"
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
                    title="Tạo lại lệnh"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
