"use client";

/**
 * TransferListTab — Realtime list of active transfer orders
 *
 * Shows transfer orders with status badges, filters (type/status),
 * and quick-action buttons context-aware by status.
 *
 * LUẬT THÉP: onSnapshot realtime, skeleton loading, no reload button.
 */

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Eye,
  PackageOpen,
  Truck,
  XCircle,
} from "lucide-react";
import type { TransferOrder } from "@bduck/shared-types";
import { TransferOrderStatus, TransferType } from "@bduck/shared-types";
import { useWarehouses } from "../../../hooks/useWarehouses";

// ─── i18n text ───
const TEXT = {
  vi: {
    empty: "Không có phiếu điều chuyển đang xử lý",
    emptyHint: 'Tạo phiếu mới ở tab "Tạo mới" để bắt đầu.',
    filterAll: "Tất cả",
    filterIntra: "Trong kho",
    filterInter: "Liên kho",
    view: "Xem",
    items: "sản phẩm",
    source: "Từ",
    dest: "Đến",
  },
  zh: {
    empty: "没有正在处理的调拨单",
    emptyHint: "在「新建」标签页创建新调拨单。",
    filterAll: "全部",
    filterIntra: "库内",
    filterInter: "跨库",
    view: "查看",
    items: "产品",
    source: "从",
    dest: "到",
  },
};

// ─── Status config ───
const STATUS_CONFIG: Record<
  string,
  { label: string; labelZh: string; color: string; Icon: React.ElementType }
> = {
  DRAFT: {
    label: "Nháp",
    labelZh: "草稿",
    color: "bg-gray-100 text-gray-600",
    Icon: Clock,
  },
  PENDING_APPROVAL: {
    label: "Chờ duyệt",
    labelZh: "待审批",
    color: "bg-amber-50 text-amber-700",
    Icon: Clock,
  },
  APPROVED: {
    label: "Đã duyệt",
    labelZh: "已审批",
    color: "bg-blue-50 text-blue-700",
    Icon: CheckCircle,
  },
  EXPORT_PENDING: {
    label: "Chờ tạo xuất",
    labelZh: "待创建出库",
    color: "bg-orange-50 text-orange-700",
    Icon: Clock,
  },
  EXPORT_CREATED: {
    label: "Đã tạo xuất",
    labelZh: "已创建出库",
    color: "bg-indigo-50 text-indigo-700",
    Icon: PackageOpen,
  },
  PICKING: {
    label: "Đang soạn",
    labelZh: "拣货中",
    color: "bg-purple-50 text-purple-700",
    Icon: PackageOpen,
  },
  IN_TRANSIT: {
    label: "Đang chuyển",
    labelZh: "运输中",
    color: "bg-sky-50 text-sky-700",
    Icon: Truck,
  },
  PENDING_RECEIVE: {
    label: "Chờ nhận",
    labelZh: "待接收",
    color: "bg-teal-50 text-teal-700",
    Icon: ArrowDownRight,
  },
  RECEIVING: {
    label: "Đang nhận",
    labelZh: "接收中",
    color: "bg-cyan-50 text-cyan-700",
    Icon: ArrowDownRight,
  },
  RECEIVED: {
    label: "Đã nhận",
    labelZh: "已接收",
    color: "bg-emerald-50 text-emerald-700",
    Icon: CheckCircle,
  },
  COMPLETED: {
    label: "Hoàn thành",
    labelZh: "完成",
    color: "bg-emerald-50 text-emerald-700",
    Icon: CheckCircle,
  },
  REJECTED: {
    label: "Từ chối",
    labelZh: "已拒绝",
    color: "bg-red-50 text-red-700",
    Icon: XCircle,
  },
  CANCELLED: {
    label: "Đã hủy",
    labelZh: "已取消",
    color: "bg-gray-100 text-gray-500",
    Icon: XCircle,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function TransferTypeBadge({ type }: { type: string }) {
  const isIntra = type === TransferType.INTRA_WAREHOUSE;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        isIntra
          ? "bg-violet-50 text-violet-600"
          : "bg-sky-50 text-sky-600"
      }`}
    >
      {isIntra ? (
        <ArrowRightLeft size={10} />
      ) : (
        <ArrowUpRight size={10} />
      )}
      {isIntra ? "Trong kho" : "Liên kho"}
    </span>
  );
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date =
    typeof value === "string"
      ? new Date(value)
      : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Props ───
interface Props {
  orders: TransferOrder[];
  onViewDetail?: (orderId: string) => void;
}

type TypeFilter = "ALL" | "INTRA" | "INTER";

export default function TransferListTab({ orders, onViewDetail }: Props) {
  const { warehouses } = useWarehouses();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const warehouseMap = useMemo(
    () => new Map(warehouses.map((w) => [w.id, w])),
    [warehouses],
  );

  const filtered = useMemo(() => {
    if (typeFilter === "ALL") return orders;
    if (typeFilter === "INTRA")
      return orders.filter(
        (o) => o.transfer_type === TransferType.INTRA_WAREHOUSE,
      );
    return orders.filter(
      (o) => o.transfer_type === TransferType.INTER_WAREHOUSE,
    );
  }, [orders, typeFilter]);

  const filterButtons: { value: TypeFilter; label: string }[] = [
    { value: "ALL", label: `Tất cả (${orders.length})` },
    {
      value: "INTRA",
      label: `Trong kho (${orders.filter((o) => o.transfer_type === TransferType.INTRA_WAREHOUSE).length})`,
    },
    {
      value: "INTER",
      label: `Liên kho (${orders.filter((o) => o.transfer_type === TransferType.INTER_WAREHOUSE).length})`,
    },
  ];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <ArrowRightLeft size={24} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          {TEXT.vi.empty}
        </p>
        <p className="mt-1 text-xs text-gray-400">{TEXT.vi.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto">
        {filterButtons.map((fb) => (
          <button
            key={fb.value}
            type="button"
            onClick={() => setTypeFilter(fb.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              typeFilter === fb.value
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Order cards */}
      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((order) => {
          const srcWarehouse = warehouseMap.get(order.source_warehouse_id);
          const dstWarehouse = warehouseMap.get(order.destination_warehouse_id);
          const isIntra =
            order.transfer_type === TransferType.INTRA_WAREHOUSE;

          return (
            <div
              key={order.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Order number + type badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {order.order_number}
                    </span>
                    <TransferTypeBadge type={order.transfer_type} />
                  </div>

                  {/* Warehouse flow */}
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <span className="max-w-[120px] truncate font-medium text-gray-700">
                      {srcWarehouse?.name || "—"}
                    </span>
                    {!isIntra && (
                      <>
                        <ArrowRightLeft
                          size={12}
                          className="shrink-0 text-gray-300"
                        />
                        <span className="max-w-[120px] truncate font-medium text-gray-700">
                          {dstWarehouse?.name || "—"}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Created date */}
                  <p className="mt-1 text-[11px] text-gray-400">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <StatusBadge status={order.status} />
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {onViewDetail && (
                  <button
                    type="button"
                    onClick={() => onViewDetail(order.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50"
                  >
                    <Eye size={13} />
                    Chi tiết
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
