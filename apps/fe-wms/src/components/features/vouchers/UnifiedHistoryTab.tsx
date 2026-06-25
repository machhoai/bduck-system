"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PackageOpen,
  Search,
  ArrowRightCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  User,
  ClipboardSignature,
  Filter,
  CalendarRange,
  FilterX,
  Store,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { UnifiedVoucher } from "../../../types/unified-voucher";
import { useExportRegistration } from "../../../hooks/useExportRegistration";
import { useTranslation } from "../../../lib/i18n";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useUsers } from "../../../hooks/useUsers";
import VoucherDetailDrawer from "../import-vouchers/VoucherDetailDrawer";
import TransferDetailDrawer from "../transfers/TransferDetailDrawer";
import {
  buildVoucherExportConfig,
  filterUnifiedVouchers,
  getDefaultVoucherFilters,
  hasActiveVoucherFilters,
  uniqueVoucherStatuses,
  type VoucherFilters,
} from "./voucherExport";

interface UnifiedHistoryTabProps {
  vouchers: UnifiedVoucher[];
  initialTypeFilter?: string;
  onClone: (data: Record<string, unknown>) => void;
}

const TYPE_CONFIG: Record<
  string,
  { bg: string; text: string; icon: React.ElementType; labelKey: string }
> = {
  IMPORT: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: ArrowDownCircle,
    labelKey: "importVoucher",
  },
  EXPORT: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    icon: ArrowUpCircle,
    labelKey: "exportVoucher",
  },
  TRANSFER: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: ArrowRightCircle,
    labelKey: "transfer",
  },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  COMPLETED: {
    bg: "bg-[var(--color-status-completed-bg)]",
    text: "text-[var(--color-status-completed-text)]",
  },
  CANCELLED: {
    bg: "bg-[var(--color-status-draft-bg)]",
    text: "text-[var(--color-status-draft-text)]",
  },
  REJECTED: {
    bg: "bg-[var(--color-status-pending-bg)]",
    text: "text-[var(--color-status-pending-text)]",
  },
};

function parseVoucherDate(value: unknown): Date | null {
  if (!value) return null;
  let date: Date;
  if (typeof (value as any).toDate === "function")
    date = (value as any).toDate();
  else if ((value as any)._seconds !== undefined)
    date = new Date((value as any)._seconds * 1000);
  else if ((value as any).seconds !== undefined)
    date = new Date((value as any).seconds * 1000);
  else date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getVoucherTimestamp(voucher: UnifiedVoucher): number {
  return parseVoucherDate(voucher.created_at)?.getTime() ?? 0;
}

function formatVoucherDateTime(value: unknown): string {
  const date = parseVoucherDate(value);
  if (!date) {
    try {
      return typeof value === "string"
        ? value
        : value
          ? JSON.stringify(value)
          : "N/A";
    } catch {
      return "N/A";
    }
  }
  return format(date, "dd/MM/yyyy HH:mm", { locale: vi });
}

function getVoucherDateGroup(voucher: UnifiedVoucher): {
  key: string;
  label: string;
} {
  const date = parseVoucherDate(voucher.created_at);
  if (!date) return { key: "unknown", label: "Không xác định ngày" };
  return {
    key: format(date, "yyyy-MM-dd"),
    label: format(date, "EEEE, dd/MM/yyyy", { locale: vi }),
  };
}

function groupVouchersByDate(vouchers: UnifiedVoucher[]) {
  return vouchers.reduce<
    Array<{ key: string; label: string; items: UnifiedVoucher[] }>
  >((groups, voucher) => {
    const groupInfo = getVoucherDateGroup(voucher);
    const existing = groups.find((group) => group.key === groupInfo.key);
    if (existing) existing.items.push(voucher);
    else groups.push({ ...groupInfo, items: [voucher] });
    return groups;
  }, []);
}

export default function UnifiedHistoryTab({
  vouchers,
  initialTypeFilter,
  onClone,
}: UnifiedHistoryTabProps) {
  const { t } = useTranslation();
  const { warehouses } = useWarehouses();
  const { users } = useUsers();

  const [filters, setFilters] = useState<VoucherFilters>(() =>
    getDefaultVoucherFilters(initialTypeFilter),
  );
  const [selectedVoucher, setSelectedVoucher] = useState<UnifiedVoucher | null>(
    null,
  );
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    null,
  );

  const warehouseById = useMemo(
    () => new Map(warehouses.map((w) => [w.id, w])),
    [warehouses],
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const statusOptions = useMemo(
    () => uniqueVoucherStatuses(vouchers),
    [vouchers],
  );

  useEffect(() => {
    setFilters((current) => ({ ...current, type: initialTypeFilter ?? "" }));
  }, [initialTypeFilter]);

  const filteredVouchers = useMemo(() => {
    return filterUnifiedVouchers(vouchers, filters);
  }, [filters, vouchers]);

  const groupedVouchers = useMemo(
    () => groupVouchersByDate(filteredVouchers),
    [filteredVouchers],
  );
  const exportConfig = useMemo(
    () =>
      buildVoucherExportConfig({
        vouchers: filteredVouchers,
        filters,
        users,
        warehouses,
        filename: "vouchers_history",
        entityType: "vouchers",
        statusLabels: (t as any).importVoucher?.status,
      }),
    [filteredVouchers, filters, t, users, warehouses],
  );

  useExportRegistration(exportConfig);

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <PackageOpen size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {(t as any).vouchers?.historyTab?.emptyTitle ||
            "Chưa có lịch sử lệnh nào"}
        </p>
        <p className="w-full text-xs leading-5 text-[var(--color-text-muted)]">
          {(t as any).vouchers?.historyTab?.emptyHint ||
            "Các lệnh đã hoàn thành hoặc bị hủy sẽ xuất hiện ở đây."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-2 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={filters.search}
            onChange={(e) =>
              setFilters((current) => ({ ...current, search: e.target.value }))
            }
            placeholder={
              (t as any).vouchers?.inProgressTab?.searchPlaceholder ||
              "Tìm theo mã lệnh, ghi chú..."
            }
            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]"
          />
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border-subtle)]">
          <Filter size={14} className="text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {(t as any).vouchers?.historyTab?.advancedFilter || "Lọc nâng cao:"}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilters((current) => ({ ...current, type: "" }))}
            className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${filters.type === "" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            {(t as any).vouchers?.inProgressTab?.filterAll || "Tất cả"}
          </button>
          <button
            onClick={() =>
              setFilters((current) => ({ ...current, type: "IMPORT" }))
            }
            className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${filters.type === "IMPORT" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            {(t as any).vouchers?.inProgressTab?.filterImport || "Nhập kho"}
          </button>
          <button
            onClick={() =>
              setFilters((current) => ({ ...current, type: "EXPORT" }))
            }
            className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${filters.type === "EXPORT" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            {(t as any).vouchers?.inProgressTab?.filterExport || "Xuất kho"}
          </button>
          <button
            onClick={() =>
              setFilters((current) => ({ ...current, type: "TRANSFER" }))
            }
            className={`h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${filters.type === "TRANSFER" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            {(t as any).vouchers?.inProgressTab?.filterTransfer ||
              "Điều chuyển"}
          </button>
        </div>

        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((current) => ({ ...current, status: e.target.value }))
          }
          className="h-8 max-w-[150px] rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
        >
          <option value="">Trạng thái (Tất cả)</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {(t as any).importVoucher?.status?.[status] || status}
            </option>
          ))}
        </select>

        <select
          value={filters.creatorId}
          onChange={(e) =>
            setFilters((current) => ({ ...current, creatorId: e.target.value }))
          }
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] max-w-[150px]"
        >
          <option value="">
            {(t as any).vouchers?.historyTab?.creatorAll ||
              "Người tạo (Tất cả)"}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
          ))}
        </select>

        <select
          value={filters.approverId}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              approverId: e.target.value,
            }))
          }
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] max-w-[150px]"
        >
          <option value="">
            {(t as any).vouchers?.historyTab?.approverAll ||
              "Người duyệt (Tất cả)"}
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
          ))}
        </select>

        <label className="relative">
          <Store
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <select
            value={filters.warehouseId}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                warehouseId: e.target.value,
              }))
            }
            title="Lọc theo kho"
            className="h-8 max-w-[170px] rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-7 pr-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">Kho (Tất cả)</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name || warehouse.code || warehouse.id}
              </option>
            ))}
          </select>
        </label>

        <label className="relative">
          <CalendarRange
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                dateFrom: e.target.value,
              }))
            }
            title="Từ ngày tạo"
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-7 pr-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
          />
        </label>

        <label className="relative">
          <Calendar
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) =>
              setFilters((current) => ({ ...current, dateTo: e.target.value }))
            }
            title="Đến ngày tạo"
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-7 pr-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
          />
        </label>

        <select
          value={filters.sort}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              sort: e.target.value as "newest" | "oldest",
            }))
          }
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
        >
          <option value="newest">
            {(t as any).vouchers?.inProgressTab?.sortNewest || "Mới nhất trước"}
          </option>
          <option value="oldest">
            {(t as any).vouchers?.inProgressTab?.sortOldest || "Cũ nhất trước"}
          </option>
        </select>

        <button
          type="button"
          onClick={() =>
            setFilters(getDefaultVoucherFilters(initialTypeFilter))
          }
          disabled={!hasActiveVoucherFilters(filters)}
          title="Xóa bộ lọc"
          aria-label="Xóa bộ lọc"
          className="inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-input)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FilterX size={14} />
        </button>
      </div>

      {/* List */}
      {filteredVouchers.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          {(t as any).vouchers?.historyTab?.noMatches ||
            "Không tìm thấy lệnh phù hợp"}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedVouchers.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                  {group.label}
                </h3>
                <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-text-muted)]">
                  {group.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.items.map((voucher) => {
                  const typeCfg = TYPE_CONFIG[voucher.type];
                  const statusCfg = STATUS_CONFIG[voucher.status] || {
                    bg: "bg-gray-100",
                    text: "text-gray-600",
                  };
                  const TypeIcon = typeCfg.icon;
                  const warehouse = warehouseById.get(voucher.warehouse_id);
                  const creator = userById.get(voucher.creator_id);

                  return (
                    <div
                      key={voucher.id}
                      onClick={() => {
                        if (voucher.type === "TRANSFER")
                          setSelectedTransferId(voucher.id);
                        else setSelectedVoucher(voucher);
                      }}
                      className="flex cursor-pointer flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 shadow-sm transition-all hover:border-[var(--color-border-focus)] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${typeCfg.bg} ${typeCfg.text}`}
                          >
                            <TypeIcon size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                              {voucher.voucher_number}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mt-0.5">
                              <span>
                                {warehouse?.name ||
                                  (t as any).vouchers?.inProgressTab
                                    ?.unknownWarehouse ||
                                  "Kho không xác định"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          {(t as any).importVoucher?.status?.[voucher.status] ||
                            voucher.status}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] p-2">
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                          <User
                            size={12}
                            className="shrink-0 text-[var(--color-text-muted)]"
                          />
                          <span className="truncate">
                            {creator?.full_name || voucher.creator_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                          <Calendar
                            size={12}
                            className="shrink-0 text-[var(--color-text-muted)]"
                          />
                          <span>
                            {formatVoucherDateTime(voucher.created_at)}
                          </span>
                        </div>
                        {voucher.approver_id && (
                          <div className="flex items-center gap-2 text-xs text-[var(--color-status-approved-text)]">
                            <ClipboardSignature
                              size={12}
                              className="shrink-0"
                            />
                            <span className="truncate">
                              {(t as any).vouchers?.inProgressTab?.approver ||
                                "Người duyệt: "}
                              {userById.get(voucher.approver_id)?.full_name ||
                                voucher.approver_id}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedVoucher && (
        <VoucherDetailDrawer
          voucher={selectedVoucher.raw as any}
          onClose={() => setSelectedVoucher(null)}
          onClone={onClone}
        />
      )}

      {selectedTransferId && (
        <TransferDetailDrawer
          orderId={selectedTransferId}
          onClose={() => setSelectedTransferId(null)}
          readOnly
          onClone={onClone}
        />
      )}
    </div>
  );
}
