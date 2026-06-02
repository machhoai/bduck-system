"use client";

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
import { TransferType } from "@bduck/shared-types";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";

const STATUS_CONFIG: Record<
  string,
  { color: string; Icon: React.ElementType }
> = {
  DRAFT: { color: "bg-gray-100 text-gray-600", Icon: Clock },
  PENDING_APPROVAL: { color: "bg-amber-50 text-amber-700", Icon: Clock },
  APPROVED: { color: "bg-blue-50 text-blue-700", Icon: CheckCircle },
  EXPORT_PENDING: { color: "bg-orange-50 text-orange-700", Icon: Clock },
  EXPORT_CREATED: { color: "bg-indigo-50 text-indigo-700", Icon: PackageOpen },
  PICKING: { color: "bg-purple-50 text-purple-700", Icon: PackageOpen },
  IN_TRANSIT: { color: "bg-sky-50 text-sky-700", Icon: Truck },
  PENDING_RECEIVE: { color: "bg-teal-50 text-teal-700", Icon: ArrowDownRight },
  RECEIVING: { color: "bg-cyan-50 text-cyan-700", Icon: ArrowDownRight },
  RECEIVED: { color: "bg-emerald-50 text-emerald-700", Icon: CheckCircle },
  COMPLETED: { color: "bg-emerald-50 text-emerald-700", Icon: CheckCircle },
  REJECTED: { color: "bg-red-50 text-red-700", Icon: XCircle },
  CANCELLED: { color: "bg-gray-100 text-gray-500", Icon: XCircle },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xxs font-semibold ${cfg.color}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

function TransferTypeBadge({
  type,
  labels,
}: {
  type: string;
  labels: { intra: string; inter: string };
}) {
  const isIntra = type === TransferType.INTRA_WAREHOUSE;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xxs font-semibold ${
        isIntra ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600"
      }`}
    >
      {isIntra ? <ArrowRightLeft size={10} /> : <ArrowUpRight size={10} />}
      {isIntra ? labels.intra : labels.inter}
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

interface Props {
  orders: TransferOrder[];
  onViewDetail?: (orderId: string) => void;
}

type TypeFilter = "ALL" | "INTRA" | "INTER";

export default function TransferListTab({ orders, onViewDetail }: Props) {
  const { t } = useTranslation();
  const { warehouses } = useWarehouses();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const transferText = t.transfer as any;

  const warehouseMap = useMemo(
    () => new Map(warehouses.map((w) => [w.id, w])),
    [warehouses],
  );

  const filtered = useMemo(() => {
    if (typeFilter === "ALL") return orders;
    if (typeFilter === "INTRA") {
      return orders.filter(
        (o) => o.transfer_type === TransferType.INTRA_WAREHOUSE,
      );
    }
    return orders.filter(
      (o) => o.transfer_type === TransferType.INTER_WAREHOUSE,
    );
  }, [orders, typeFilter]);

  const filterButtons: { value: TypeFilter; label: string }[] = [
    {
      value: "ALL",
      label: `${transferText.filter?.all ?? ""} (${orders.length})`,
    },
    {
      value: "INTRA",
      label: `${transferText.filter?.intra ?? t.transfer.type.INTRA_WAREHOUSE} (${
        orders.filter((o) => o.transfer_type === TransferType.INTRA_WAREHOUSE)
          .length
      })`,
    },
    {
      value: "INTER",
      label: `${transferText.filter?.inter ?? t.transfer.type.INTER_WAREHOUSE} (${
        orders.filter((o) => o.transfer_type === TransferType.INTER_WAREHOUSE)
          .length
      })`,
    },
  ];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <ArrowRightLeft size={24} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          {transferText.empty?.inProgress ?? ""}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {transferText.empty?.inProgressHint ?? ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((order) => {
          const srcWarehouse = warehouseMap.get(order.source_warehouse_id);
          const dstWarehouse = warehouseMap.get(order.destination_warehouse_id);
          const isIntra = order.transfer_type === TransferType.INTRA_WAREHOUSE;
          const statusLabel =
            t.transfer.status[
              order.status as keyof typeof t.transfer.status
            ] ?? order.status;

          return (
            <div
              key={order.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {order.order_number}
                    </span>
                    <TransferTypeBadge
                      type={order.transfer_type}
                      labels={{
                        intra: t.transfer.type.INTRA_WAREHOUSE,
                        inter: t.transfer.type.INTER_WAREHOUSE,
                      }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-32 truncate font-medium text-gray-700">
                      {srcWarehouse?.name || "-"}
                    </span>
                    {!isIntra && (
                      <>
                        <ArrowRightLeft
                          size={12}
                          className="shrink-0 text-gray-300"
                        />
                        <span className="w-32 truncate font-medium text-gray-700">
                          {dstWarehouse?.name || "-"}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-1 text-xxs text-gray-400">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <StatusBadge status={order.status} label={statusLabel} />
              </div>

              <div className="mt-3 flex gap-2">
                {onViewDetail && (
                  <button
                    type="button"
                    onClick={() => onViewDetail(order.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50"
                  >
                    <Eye size={13} />
                    {transferText.actions?.viewDetail ?? "Chi tiết"}
                  </button>
                )}
                {onViewDetail &&
                  (order.status === "PENDING_RECEIVE" ||
                    order.status === "RECEIVING") && (
                    <button
                      type="button"
                      onClick={() => onViewDetail(order.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700"
                    >
                      <ArrowDownRight size={13} />
                      {transferText.actions?.receive ?? "Nhận hàng"}
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
