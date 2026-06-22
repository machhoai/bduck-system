"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import {
  ArrowRightLeft,
  Ban,
  Barcode,
  Calendar,
  CheckCircle2,
  ClipboardSignature,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Package,
  Ruler,
  ShieldAlert,
  Truck,
  User,
  Warehouse,
  X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  collection,
  doc,
  getDoc,
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
import { getStatusStyle } from "@/components/ui/StatusBadge";
import { cancelApproval, forceCancelApproval } from "@/hooks/useApprovalApi";
import { useProcessConfig } from "@/hooks/useProcessConfig";
import { useUserStore } from "@/stores/useUserStore";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";
import AttachmentSection from "@/components/tasks/AttachmentSection";
import TaskProductThumb from "@/components/tasks/TaskProductThumb";

interface TransferItemInput {
  id: string;
  product_id: string;
  quantity: number;
}

interface EnrichedTransferItem extends TransferItemInput {
  product_name: string;
  product_code: string;
  barcode: string | null;
  product_image_url: string | null;
  unit: string;
  source_location_id: string | null;
  destination_location_id: string | null;
  source_location_name: string | null;
  destination_location_name: string | null;
  received_quantity: number | null;
  status: string;
}

interface EmbeddedTransferItem {
  id?: unknown;
  product_id?: unknown;
  product_name?: unknown;
  product_code?: unknown;
  product_sku?: unknown;
  barcode?: unknown;
  product_image_url?: unknown;
  unit?: unknown;
  source_location_id?: unknown;
  destination_location_id?: unknown;
  quantity?: unknown;
  received_quantity?: unknown;
  status?: unknown;
}

interface TransferDetailDrawerProps {
  orderId: string;
  onClose: () => void;
  readOnly?: boolean;
}

const TERMINAL_STATUSES = new Set<string>([
  TransferOrderStatus.CANCELLED,
  TransferOrderStatus.COMPLETED,
]);

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-5 w-2/3 rounded bg-[var(--color-skeleton-base)]" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-neutral-100)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-16 rounded bg-[var(--color-neutral-100)]" />
              <div className="h-4 w-40 rounded bg-[var(--color-skeleton-base)]" />
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
    second: "2-digit",
  });
}

function formatNumber(val: number): string {
  return new Intl.NumberFormat("vi-VN").format(val);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getFirstImageUrl(value: unknown, fallback?: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    if (first) return first;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(fallback)) {
    return fallback.find((item) => typeof item === "string" && item.trim()) ?? null;
  }

  return typeof fallback === "string" && fallback.trim() ? fallback : null;
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-0.5 break-all text-sm font-medium text-[var(--color-text-primary)]">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

async function resolveUserName(userId: string) {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return userId;
    const user = snap.data();
    return asString(user.full_name) || asString(user.email) || userId;
  } catch {
    return userId;
  }
}

export default function TransferDetailDrawer({
  orderId,
  onClose,
  readOnly = false,
}: TransferDetailDrawerProps) {
  const { t } = useTranslation();
  const { warehouses } = useWarehouses();
  const currentUser = useUserStore((s) => s.user);
  const hasPermission = useUserStore((s) => s.hasPermission);
  const [order, setOrder] = useState<TransferOrder | null>(null);
  const [items, setItems] = useState<EnrichedTransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [creatorName, setCreatorName] = useState("");
  const [legacyApproverName, setLegacyApproverName] = useState("");
  const [approvers, setApprovers] = useState<
    { id: string; name: string; approved_at: unknown }[]
  >([]);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [otpAction, setOtpAction] = useState<"cancel" | "forceCancel" | null>(
    null,
  );
  const { config: processConfig } = useProcessConfig(
    "TRANSFER_ORDER",
    order?.source_warehouse_id,
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "transfer_orders", orderId),
      (snap) => {
        setOrder(snap.exists() ? ({ id: snap.id, ...snap.data() } as TransferOrder) : null);
        setLoading(false);
      },
      (error) => {
        console.error("[TransferDetailDrawer] Order snapshot error:", error);
        setOrder(null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!order?.creator_id) {
      setCreatorName("");
      return;
    }

    void resolveUserName(order.creator_id).then(setCreatorName);
  }, [order?.creator_id]);

  useEffect(() => {
    if (!order?.approver_id) {
      setLegacyApproverName("");
      return;
    }

    void resolveUserName(order.approver_id).then(setLegacyApproverName);
  }, [order?.approver_id]);

  useEffect(() => {
    const approvalsQuery = query(
      collection(db, "pending_approvals"),
      where("entity_id", "==", orderId),
      where("status", "==", "APPROVED"),
    );

    const unsub = onSnapshot(approvalsQuery, async (snap) => {
      const records = snap.docs.map((approvalDoc) => approvalDoc.data());
      records.sort((a, b) => asNumber(a.level) - asNumber(b.level));

      const approverData = await Promise.all(
        records.map(async (record) => {
          const approverId = asString(record.approver_id);
          return {
            id: approverId,
            name: approverId ? await resolveUserName(approverId) : "—",
            approved_at: record.approved_at,
          };
        }),
      );

      setApprovers(approverData);
    });

    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    setLoadingItems(true);

    const enrichItems = async (rawItems: EmbeddedTransferItem[]) => {
      const enriched = await Promise.all(
        rawItems.map(async (item, index): Promise<EnrichedTransferItem> => {
          const productId = asString(item.product_id);
          let productName = asString(item.product_name) || productId;
          let productCode = asString(item.product_code) || asString(item.product_sku);
          let barcode = asNullableString(item.barcode);
          let productImageUrl = getFirstImageUrl(item.product_image_url);
          let unit = asString(item.unit);

          if (productId) {
            try {
              const productSnap = await getDoc(doc(db, "products", productId));
              if (productSnap.exists()) {
                const product = productSnap.data();
                productName = asString(product.name) || productName;
                productCode = asString(product.code) || productCode;
                barcode = asNullableString(product.barcode) || barcode;
                productImageUrl = getFirstImageUrl(
                  item.product_image_url,
                  product.product_image_url,
                );
                unit = asString(product.unit) || unit;
              }
            } catch {
              // Fall back to denormalized item fields.
            }
          }

          const sourceLocationId = asNullableString(item.source_location_id);
          const destinationLocationId = asNullableString(item.destination_location_id);
          let sourceLocationName: string | null = null;
          let destinationLocationName: string | null = null;

          if (sourceLocationId) {
            try {
              const locationSnap = await getDoc(
                doc(db, "warehouse_locations", sourceLocationId),
              );
              sourceLocationName = locationSnap.exists()
                ? asString(locationSnap.data().name) || sourceLocationId
                : sourceLocationId;
            } catch {
              sourceLocationName = sourceLocationId;
            }
          }

          if (destinationLocationId) {
            try {
              const locationSnap = await getDoc(
                doc(db, "warehouse_locations", destinationLocationId),
              );
              destinationLocationName = locationSnap.exists()
                ? asString(locationSnap.data().name) || destinationLocationId
                : destinationLocationId;
            } catch {
              destinationLocationName = destinationLocationId;
            }
          }

          return {
            id: asString(item.id) || `${orderId}-${index}`,
            product_id: productId,
            product_name: productName,
            product_code: productCode,
            barcode,
            product_image_url: productImageUrl,
            unit,
            source_location_id: sourceLocationId,
            destination_location_id: destinationLocationId,
            source_location_name: sourceLocationName,
            destination_location_name: destinationLocationName,
            quantity: asNumber(item.quantity),
            received_quantity:
              typeof item.received_quantity === "number"
                ? item.received_quantity
                : null,
            status: asString(item.status),
          };
        }),
      );

      setItems(enriched);
      setLoadingItems(false);
    };

    const itemsRef = collection(db, "transfer_orders", orderId, "items");
    const unsubscribe = onSnapshot(
      query(itemsRef, where("is_deleted", "==", false)),
      async (itemsSnap) => {
        let rawItems = itemsSnap.docs.map((itemDoc) => ({
          id: itemDoc.id,
          ...itemDoc.data(),
        })) as EmbeddedTransferItem[];

        if (rawItems.length === 0) {
          const orderSnap = await getDoc(doc(db, "transfer_orders", orderId));
          const embeddedItems = orderSnap.data()?.items;
          rawItems = Array.isArray(embeddedItems)
            ? (embeddedItems as EmbeddedTransferItem[])
            : [];
        }

        await enrichItems(rawItems);
      },
      (error) => {
        console.error("[TransferDetailDrawer] Items snapshot error:", error);
        setItems([]);
        setLoadingItems(false);
      },
    );

    return () => unsubscribe();
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

  const canCreatorCancel =
    order?.creator_id === currentUser?.id &&
    order?.status === TransferOrderStatus.PENDING_APPROVAL;
  const canForceCancel =
    !!order &&
    hasPermission("vouchers.force_cancel") &&
    !TERMINAL_STATUSES.has(order.status);
  const showCancelSection = !!order && (canCreatorCancel || canForceCancel);

  const transferDetail =
    (t.transfer as { detail?: Record<string, string> }).detail ?? {};
  const taskDetail = t.tasks.detail as Record<string, string>;
  const statusLabel =
    order?.status
      ? (t.transfer.status[
          order.status as keyof typeof t.transfer.status
        ] ?? order.status)
      : "";
  const statusColor = getStatusStyle(order?.status ?? "DRAFT");
  const attachmentUrls = order?.attachment_urls || [];
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const receivedQuantity = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (typeof item.received_quantity === "number" ? item.received_quantity : 0),
        0,
      ),
    [items],
  );

  const handleCreatorCancel = useCallback(
    async (otp?: string) => {
      if (!order || isSubmittingCancel) return;
      if (processConfig?.require_otp && !otp) {
        setOtpAction("cancel");
        return;
      }

      setOtpAction(null);
      setIsSubmittingCancel(true);
      const submitAction = async () => {
        await cancelApproval("TRANSFER_ORDER", order.id, cancelReason || undefined, otp);
      };

      try {
        const promise = submitAction();
        gooeyToast.promise(promise, {
          loading: t.tasks.selfApproval.cancelling,
          success: t.tasks.selfApproval.cancelSuccess,
          error: t.tasks.selfApproval.cancelError,
          description: {
            success: t.tasks.selfApproval.cancelSuccessDesc,
            error: t.tasks.selfApproval.cancelErrorDesc,
          },
          action: {
            error: {
              label: t.tasks.approval.retry,
              onClick: () => undefined,
            },
          },
        });
        await promise;
        onClose();
      } finally {
        setIsSubmittingCancel(false);
      }
    },
    [cancelReason, isSubmittingCancel, onClose, order, processConfig, t],
  );

  const handleForceCancel = useCallback(
    async (otp?: string) => {
      if (!order || isSubmittingCancel) return;
      if (!cancelReason.trim()) {
        gooeyToast.error(t.tasks.selfApproval.forceCancelReasonRequired, {
          preset: "snappy",
        });
        return;
      }

      if (processConfig?.require_otp && !otp) {
        setOtpAction("forceCancel");
        return;
      }

      setOtpAction(null);
      setIsSubmittingCancel(true);
      const submitAction = async () => {
        await forceCancelApproval("TRANSFER_ORDER", order.id, cancelReason, otp);
      };

      try {
        const promise = submitAction();
        gooeyToast.promise(promise, {
          loading: t.tasks.selfApproval.cancelling,
          success: t.tasks.selfApproval.cancelSuccess,
          error: t.tasks.selfApproval.cancelError,
          description: {
            success: t.tasks.selfApproval.cancelSuccessDesc,
            error: t.tasks.selfApproval.cancelErrorDesc,
          },
          action: {
            error: {
              label: t.tasks.approval.retry,
              onClick: () => undefined,
            },
          },
        });
        await promise;
        onClose();
      } finally {
        setIsSubmittingCancel(false);
      }
    },
    [cancelReason, isSubmittingCancel, onClose, order, processConfig, t],
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 flex w-[90%] flex-col bg-white shadow-2xl lg:w-2/3">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)]">
              <ArrowRightLeft className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {transferDetail.title ?? "Chi tiết chuyển kho"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {order?.order_number ?? `${orderId.slice(0, 12)}...`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <DetailSkeleton />
          ) : !order ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Package className="h-8 w-12 text-[var(--color-neutral-300)]" />
              <p className="mt-3 text-sm font-medium text-[var(--color-text-muted)]">
                {transferDetail.notFound ?? "Không tìm thấy phiếu"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-5">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
                >
                  {statusLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xxs font-semibold ${
                    order.transfer_type === TransferType.INTRA_WAREHOUSE
                      ? "bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)]"
                      : "bg-[var(--color-status-transit-bg)] text-[var(--color-status-transit-text)]"
                  }`}
                >
                  {order.transfer_type === TransferType.INTRA_WAREHOUSE
                    ? t.transfer.type.INTRA_WAREHOUSE
                    : t.transfer.type.INTER_WAREHOUSE}
                </span>
              </div>

              <div className="px-4 pt-2">
                <Field icon={Hash} label="Mã phiếu" value={order.order_number} />
                <Field
                  icon={Warehouse}
                  label={transferDetail.source ?? "Kho nguồn"}
                  value={srcWarehouse?.name ?? order.source_warehouse_id}
                />
                <Field
                  icon={Truck}
                  label={transferDetail.destination ?? "Kho đích"}
                  value={dstWarehouse?.name ?? order.destination_warehouse_id}
                />
                <Field
                  icon={User}
                  label={taskDetail.creator ?? "Người tạo"}
                  value={creatorName || order.creator_id}
                />
                <Field
                  icon={Calendar}
                  label={taskDetail.createdAt ?? "Ngày tạo"}
                  value={formatDate(order.created_at)}
                />
                {order.approved_at && (
                  <Field
                    icon={CheckCircle2}
                    label="Ngày duyệt"
                    value={formatDate(order.approved_at)}
                  />
                )}
                {order.dispatched_at && (
                  <Field
                    icon={Truck}
                    label={transferDetail.dispatchedAt ?? "Ngày xuất kho"}
                    value={formatDate(order.dispatched_at)}
                  />
                )}
                {order.received_at && (
                  <Field
                    icon={CheckCircle2}
                    label="Ngày nhận"
                    value={formatDate(order.received_at)}
                  />
                )}
                {order.status === TransferOrderStatus.COMPLETED && (
                  <Field
                    icon={CheckCircle2}
                    label={taskDetail.completedAt ?? "Ngày hoàn thành"}
                    value={formatDate(order.updated_at)}
                  />
                )}
                {order.export_voucher_id && (
                  <Field
                    icon={FileText}
                    label="Phiếu xuất liên quan"
                    value={order.export_voucher_id}
                  />
                )}

                {approvers.length > 0 ? (
                  <div className="flex flex-col gap-1 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
                        <ClipboardSignature className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">
                        {taskDetail.approvers ?? "Người duyệt"}
                      </p>
                    </div>
                    <div className="mt-1 space-y-1 pl-11">
                      {approvers.map((approver, idx) => (
                        <div key={`${approver.id}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {approver.name}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {formatDate(approver.approved_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  order.approver_id && (
                    <Field
                      icon={ClipboardSignature}
                      label={taskDetail.approver ?? "Người duyệt"}
                      value={legacyApproverName || order.approver_id}
                    />
                  )
                )}

                {order.notes && (
                  <Field
                    icon={FileText}
                    label={taskDetail.notes ?? "Ghi chú"}
                    value={order.notes}
                  />
                )}
              </div>

              <div className="mt-4 px-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {t.tasks.items.title} ({items.length} {t.tasks.items.productCount})
                </h3>
                {loadingItems ? (
                  <div className="animate-pulse space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]/50 p-3"
                      >
                        <div className="h-4 w-40 rounded bg-[var(--color-skeleton-base)]" />
                        <div className="mt-2 h-3 w-24 rounded bg-[var(--color-neutral-100)]" />
                      </div>
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                    {t.tasks.items.empty}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]/50 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <TaskProductThumb
                            imageUrl={item.product_image_url}
                            name={item.product_name}
                            sku={item.product_code}
                            className="h-16 w-16 rounded-xl"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                  {item.product_name || item.product_id}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                  {item.product_code && (
                                    <span className="flex items-center gap-0.5">
                                      <Ruler className="h-3 w-3" />
                                      {taskDetail.sku ?? "SKU"}: {item.product_code}
                                    </span>
                                  )}
                                  {item.barcode && (
                                    <span className="flex items-center gap-0.5">
                                      <Barcode className="h-3 w-3" />
                                      {item.barcode}
                                    </span>
                                  )}
                                  {item.unit && (
                                    <span className="rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-xxs font-medium text-[var(--color-neutral-600)]">
                                      {item.unit}
                                    </span>
                                  )}
                                  {item.status && (
                                    <span className="rounded bg-[var(--color-status-transit-bg)] px-1.5 py-0.5 text-xxs font-medium text-[var(--color-status-transit-text)]">
                                      {item.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
                                x{formatNumber(item.quantity)}
                              </p>
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                              <span>
                                {taskDetail.quantity ?? "Số lượng"}:{" "}
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {formatNumber(item.quantity)}
                                </span>
                              </span>
                              {item.received_quantity !== null && (
                                <span>
                                  Đã nhận:{" "}
                                  <span className="font-medium text-[var(--color-text-primary)]">
                                    {formatNumber(item.received_quantity)}
                                  </span>
                                </span>
                              )}
                            </div>

                            {(item.source_location_name || item.destination_location_name) && (
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                <MapPin className="h-3 w-3 shrink-0 text-[var(--color-status-transit-icon)]" />
                                <span className="min-w-0 truncate">
                                  Từ:{" "}
                                  <span className="font-medium text-[var(--color-text-primary)]">
                                    {item.source_location_name || "—"}
                                  </span>
                                  {" -> "}
                                  Đến:{" "}
                                  <span className="font-medium text-[var(--color-text-primary)]">
                                    {item.destination_location_name || "—"}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--color-status-approved-bg)] px-4 py-3">
                    <span className="text-sm font-medium text-[var(--color-status-approved-text)]">
                      Tổng số lượng
                    </span>
                    <span className="text-base font-bold text-[var(--color-brand-primary)]">
                      {formatNumber(totalQuantity)}
                      {receivedQuantity > 0 && ` / đã nhận ${formatNumber(receivedQuantity)}`}
                    </span>
                  </div>
                )}
              </div>

              <AttachmentSection urls={attachmentUrls} t={t} />

              {isReceivePhase && !readOnly && (
                <div className="mt-4 border-t border-[var(--color-border-soft)] px-4 pt-4 pb-4">
                  <ReceiveTransferPanel
                    order={order}
                    orderItems={items}
                    onCompleted={onClose}
                  />
                </div>
              )}

              <div className="h-6" />
            </>
          )}
        </div>

        {showCancelSection && (
          <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4">
            <div className="space-y-3">
              <div
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  canForceCancel && !canCreatorCancel
                    ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]"
                    : "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]"
                }`}
              >
                <ShieldAlert
                  className={`h-5 w-5 flex-shrink-0 ${
                    canForceCancel && !canCreatorCancel
                      ? "text-[var(--color-error-text)]"
                      : "text-[var(--color-status-pending-icon)]"
                  }`}
                />
                <p
                  className={`text-xs leading-relaxed ${
                    canForceCancel && !canCreatorCancel
                      ? "text-[var(--color-error-text)]"
                      : "text-[var(--color-status-pending-text)]"
                  }`}
                >
                  {canForceCancel && !canCreatorCancel
                    ? t.tasks.selfApproval.forceCancelDescription
                    : t.tasks.selfApproval.description}
                </p>
              </div>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder={
                  canForceCancel && !canCreatorCancel
                    ? t.tasks.selfApproval.forceCancelReason
                    : t.tasks.selfApproval.cancelReason
                }
                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface-input)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
              />

              <div className="flex items-center gap-2">
                {canCreatorCancel && (
                  <button
                    type="button"
                    onClick={() => void handleCreatorCancel()}
                    disabled={isSubmittingCancel}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition-all hover:bg-[var(--color-error-bg)] active:bg-[var(--color-error-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmittingCancel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    {t.tasks.selfApproval.cancelButton}
                  </button>
                )}
                {canForceCancel && (
                  <button
                    type="button"
                    onClick={() => void handleForceCancel()}
                    disabled={isSubmittingCancel || !cancelReason.trim()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition-all hover:bg-[var(--color-error-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmittingCancel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-4 w-4" />
                    )}
                    {t.tasks.selfApproval.forceCancelButton}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!!otpAction && (
        <ActionOtpModal
          onConfirm={(code) => {
            if (otpAction === "cancel") void handleCreatorCancel(code);
            if (otpAction === "forceCancel") void handleForceCancel(code);
          }}
          onCancel={() => setOtpAction(null)}
          isSubmitting={isSubmittingCancel}
        />
      )}
    </>
  );
}
