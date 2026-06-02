"use client";

/**
 * TransferDetailDrawer — Slide-over drawer for transfer order detail
 *
 * Renders:
 * - Transfer order info (source/dest warehouse, status, timestamps)
 * - Item list
 * - ReceiveTransferPanel when status = PENDING_RECEIVE or RECEIVING
 *
 * LUẬT THÉP:
 * - Realtime via onSnapshot for the order doc
 * - Skeleton loading
 * - Light theme only
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Package,
  Truck,
  X,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { TransferOrder } from "@bduck/shared-types";
import { TransferOrderStatus, TransferType } from "@bduck/shared-types";
import { db } from "../../../lib/firebase";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import ReceiveTransferPanel from "./ReceiveTransferPanel";

interface TransferItemInput {
  id: string;
  product_id: string;
  quantity: number;
}

interface TransferDetailDrawerProps {
  orderId: string;
  onClose: () => void;
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-5 w-2/3 rounded bg-gray-200" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-16 rounded bg-gray-100" />
              <div className="h-4 w-40 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as Record<string, unknown>).toDate === "function"
  ) {
    d = (val as { toDate: () => Date }).toDate();
  } else if (typeof val === "object" && val !== null && "seconds" in val) {
    d = new Date((val as { seconds: number }).seconds * 1000);
  } else {
    d = new Date(val as string);
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  EXPORT_CREATED: "bg-indigo-100 text-indigo-700",
  PICKING: "bg-purple-100 text-purple-700",
  IN_TRANSIT: "bg-sky-100 text-sky-700",
  PENDING_RECEIVE: "bg-teal-100 text-teal-700",
  RECEIVING: "bg-cyan-100 text-cyan-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function TransferDetailDrawer({
  orderId,
  onClose,
}: TransferDetailDrawerProps) {
  const { t } = useTranslation();
  const { warehouses } = useWarehouses();
  const [order, setOrder] = useState<TransferOrder | null>(null);
  const [items, setItems] = useState<TransferItemInput[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime listener for order document
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "transfer_orders", orderId),
      (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() } as TransferOrder);
        }
        setLoading(false);
      },
      (error) => {
        console.error("[TransferDetailDrawer] Order snapshot error:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orderId]);

  // Load items once
  useEffect(() => {
    async function loadItems() {
      try {
        const itemsRef = collection(db, "transfer_orders", orderId, "items");
        const itemsSnap = await getDocs(
          query(itemsRef, where("is_deleted", "==", false)),
        );
        const loaded: TransferItemInput[] = itemsSnap.docs.map((d) => ({
          id: d.id,
          product_id: d.data().product_id,
          quantity: d.data().quantity || 0,
        }));
        setItems(loaded);
      } catch (err) {
        console.error("[TransferDetailDrawer] Items load error:", err);
      }
    }
    loadItems();
  }, [orderId]);

  const srcWarehouse = warehouses.find(
    (w) => w.id === order?.source_warehouse_id,
  );
  const dstWarehouse = warehouses.find(
    (w) => w.id === order?.destination_warehouse_id,
  );

  const isReceivePhase =
    order?.status === TransferOrderStatus.PENDING_RECEIVE ||
    order?.status === TransferOrderStatus.RECEIVING;

  const transferText = t.transfer as any;

  const statusLabel =
    order?.status
      ? (t.transfer.status[
          order.status as keyof typeof t.transfer.status
        ] ?? order.status)
      : "";

  const statusColor = STATUS_COLORS[order?.status ?? ""] ?? STATUS_COLORS.DRAFT;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 flex h-[calc(100dvh-68px)] w-[90%] flex-col bg-white shadow-2xl md:h-full lg:w-2/3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <ArrowRightLeft className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {transferText.detail?.title ?? "Chi tiết chuyển kho"}
              </h2>
              <p className="mt-0.5 text-xxs text-gray-500">
                {order?.order_number ?? orderId.slice(0, 12) + "..."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <DetailSkeleton />
          ) : !order ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Package className="h-8 w-12 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">
                {transferText.detail?.notFound ?? "Không tìm thấy phiếu"}
              </p>
            </div>
          ) : (
            <>
              {/* Status + Type badges */}
              <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
                >
                  {statusLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xxs font-semibold ${
                    order.transfer_type === TransferType.INTRA_WAREHOUSE
                      ? "bg-violet-50 text-violet-600"
                      : "bg-sky-50 text-sky-600"
                  }`}
                >
                  {order.transfer_type === TransferType.INTRA_WAREHOUSE
                    ? t.transfer.type.INTRA_WAREHOUSE
                    : t.transfer.type.INTER_WAREHOUSE}
                </span>
              </div>

              {/* Info fields */}
              <div className="space-y-2 px-4 pt-3">
                <InfoRow
                  label={transferText.detail?.source ?? "Kho nguồn"}
                  value={srcWarehouse?.name ?? order.source_warehouse_id}
                />
                <InfoRow
                  label={transferText.detail?.destination ?? "Kho đích"}
                  value={dstWarehouse?.name ?? order.destination_warehouse_id}
                />
                <InfoRow
                  label={transferText.detail?.createdAt ?? "Ngày tạo"}
                  value={formatDate(order.created_at)}
                />
                {order.dispatched_at && (
                  <InfoRow
                    label={transferText.detail?.dispatchedAt ?? "Ngày xuất kho"}
                    value={formatDate(order.dispatched_at)}
                  />
                )}
                {order.notes && (
                  <InfoRow
                    label={transferText.detail?.notes ?? "Ghi chú"}
                    value={order.notes}
                  />
                )}
              </div>

              {/* Items summary */}
              <div className="mt-4 px-4">
                <h3 className="mb-2 text-xxs font-semibold uppercase tracking-wider text-gray-400">
                  {transferText.detail?.items ?? "Danh sách hàng"} ({items.length})
                </h3>
                {items.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-400">
                    {transferText.detail?.noItems ?? "Không có sản phẩm"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                      >
                        <span className="truncate text-sm text-gray-700">
                          {item.product_id.slice(0, 8)}...
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receive panel — only when PENDING_RECEIVE or RECEIVING */}
              {isReceivePhase && (
                <div className="mt-4 border-t border-gray-100 px-4 pt-4 pb-4">
                  <ReceiveTransferPanel
                    order={order}
                    orderItems={items}
                    onCompleted={onClose}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}
