"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  MapPin,
  Package,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { TransferOrder } from "@bduck/shared-types";
import { TransferOrderStatus } from "@bduck/shared-types";
import { useProducts } from "../../../hooks/useProducts";
import {
  completeReceiving,
  startReceiving,
} from "../../../hooks/useTransferOrderApi";
import {
  useWarehouseLocations,
  useWarehouses,
} from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import { TRANSFER_RECEIVING_TEXT } from "../../../lib/i18n/componentTranslations";

interface TransferItemInput {
  id: string;
  product_id: string;
  quantity: number;
}

interface Props {
  order: TransferOrder;
  orderItems: TransferItemInput[];
  onCompleted?: () => void;
}

interface ReceiveItemState {
  item_id: string;
  product_id: string;
  product_name: string;
  expected_quantity: number;
  received_quantity: number;
  destination_location_id: string;
}

export default function ReceiveTransferPanel({
  order,
  orderItems,
  onCompleted,
}: Props) {
  const { lang } = useTranslation();
  const copy = TRANSFER_RECEIVING_TEXT[lang === "zh" ? "zh" : "vi"];
  const { warehouses } = useWarehouses();
  const { products } = useProducts();
  const { locations: destLocations, loading: locLoading } =
    useWarehouseLocations(order.destination_warehouse_id);
  const [items, setItems] = useState<ReceiveItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const destWarehouse = warehouses.find(
    (w) => w.id === order.destination_warehouse_id,
  );
  const srcWarehouse = warehouses.find(
    (w) => w.id === order.source_warehouse_id,
  );

  useEffect(() => {
    if (!orderItems || orderItems.length === 0 || items.length > 0) return;
    setItems(
      orderItems.map((orderItem) => {
        const product = products.find((p) => p.id === orderItem.product_id);
        return {
          item_id: orderItem.id,
          product_id: orderItem.product_id,
          product_name: product?.name || orderItem.product_id,
          expected_quantity: orderItem.quantity,
          received_quantity: orderItem.quantity,
          destination_location_id: "",
        };
      }),
    );
  }, [orderItems, products, items.length]);

  const updateItem = (
    itemId: string,
    field: keyof ReceiveItemState,
    value: unknown,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const canSubmit = useMemo(() => {
    if (items.length === 0) return false;
    return items.every(
      (item) => item.destination_location_id !== "" && item.received_quantity > 0,
    );
  }, [items]);

  const isPendingReceive =
    order.status === TransferOrderStatus.PENDING_RECEIVE;
  const isReceiving = order.status === TransferOrderStatus.RECEIVING;

  const handleStartReceiving = useCallback(async () => {
    try {
      await gooeyToast.promise(startReceiving(order.id), {
        loading: copy.starting,
        success: copy.started,
        error: copy.startError,
        description: {
          success: copy.startedDesc,
          error: copy.errorDesc,
        },
        action: {
          error: {
            label: copy.retry,
            onClick: () => void handleStartReceiving(),
          },
        },
      });
    } catch {
      // Toast handles error.
    }
  }, [order.id]);

  const handleCompleteReceiving = async () => {
    if (isSubmitting) return;
    setShowConfirm(false);
    setIsSubmitting(true);

    const submitAction = async () => {
      await completeReceiving(
        order.id,
        items.map((item) => ({
          item_id: item.item_id,
          destination_location_id: item.destination_location_id,
          received_quantity: item.received_quantity,
        })),
      );
    };

    try {
      const promise = submitAction();
      
      gooeyToast.promise(promise, {
        loading: copy.completing,
        success: copy.completed,
        error: copy.completeError,
        description: {
          success: copy.completedDesc,
          error: copy.errorDesc,
        },
        action: {
          error: {
            label: copy.retry,
            onClick: () => void handleCompleteReceiving(),
          },
        },
      });

      await promise;
      onCompleted?.();
    } catch {
      // Toast handles error.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-status-transit-border)] bg-[var(--color-status-transit-bg)] p-4">
        <div className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-transit-icon)] text-white">
          <ArrowDownRight size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--color-status-transit-text)]">{copy.title}</h3>
          <p className="text-xs text-[var(--color-status-transit-text)]">
            {srcWarehouse?.name || copy.sourceFallback} {"->"}{" "}
            {destWarehouse?.name || copy.destinationFallback}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-status-transit-bg-muted)] px-2.5 py-1 text-xxs font-semibold text-[var(--color-status-transit-text)]">
          {order.order_number}
        </span>
      </div>

      {isPendingReceive && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-neutral-300)] py-4">
          <Package size={32} className="text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-neutral-600)]">{copy.readyText}</p>
          <button
            type="button"
            onClick={handleStartReceiving}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-status-transit-icon)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            <ArrowDownRight size={16} />
            {copy.startReceiving}
          </button>
        </div>
      )}

      {isReceiving && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {copy.chooseLocations}{" "}
              <span className="text-xs text-[var(--color-text-muted)]">
                ({items.length} {copy.products})
              </span>
            </p>

            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.product_id);

              return (
                <div
                  key={item.item_id}
                  className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-status-transit-bg-muted)] text-xxs font-semibold text-[var(--color-status-transit-text)]">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {product?.code} / {product?.unit}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-0.5 block text-xxs text-[var(--color-text-muted)]">
                        {copy.receivedQty} ({copy.expected}:{" "}
                        {item.expected_quantity})
                      </span>
                      <input
                        type="number"
                        value={item.received_quantity || ""}
                        onChange={(e) =>
                          updateItem(
                            item.item_id,
                            "received_quantity",
                            Number(e.target.value),
                          )
                        }
                        min={0}
                        max={item.expected_quantity}
                        className="w-full rounded border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                      />
                    </label>

                    <label>
                      <span className="mb-0.5 flex items-center gap-1 text-xxs text-[var(--color-text-muted)]">
                        <MapPin size={10} className="text-[var(--color-status-transit-icon)]" />
                        {copy.destinationLocation} *
                      </span>
                      <select
                        value={item.destination_location_id}
                        onChange={(e) =>
                          updateItem(
                            item.item_id,
                            "destination_location_id",
                            e.target.value,
                          )
                        }
                        disabled={locLoading}
                         className={`w-full rounded border bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50 ${
                          !item.destination_location_id && !locLoading
                            ? "border-[var(--color-status-pending-border)]"
                            : "border-[var(--color-border-subtle)]"
                        }`}
                      >
                        <option value="">
                          {locLoading ? copy.loading : copy.selectLocation}
                        </option>
                        {destLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} ({location.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {item.received_quantity !== item.expected_quantity &&
                    item.received_quantity > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[var(--color-status-pending-bg)] px-2.5 py-1.5 text-xxs text-[var(--color-status-pending-text)]">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          {copy.mismatch
                            .replace(
                              "{received}",
                              String(item.received_quantity),
                            )
                            .replace(
                              "{expected}",
                              String(item.expected_quantity),
                            )}
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canSubmit || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-status-transit-icon)] px-5 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {isSubmitting ? copy.completing : copy.confirmReceive}
          </button>
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[500px] rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {copy.confirmQuestion}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {copy.confirmDesc.replace(
                "{warehouse}",
                destWarehouse?.name || copy.destinationFallback,
              )}
            </p>
            <div className="mt-4 max-h-32 overflow-y-auto rounded-lg border border-[var(--color-border-soft)] text-xs">
              <table className="w-full">
                <thead className="bg-[var(--color-surface-subtle)]">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-[var(--color-text-muted)]">
                      {copy.product}
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-[var(--color-text-muted)]">
                      SL
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-[var(--color-text-muted)]">
                      {copy.location}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const location = destLocations.find(
                      (l) => l.id === item.destination_location_id,
                    );
                    return (
                      <tr key={item.item_id} className="border-t border-[var(--color-border-soft)]">
                        <td className="px-2 py-1 text-[var(--color-text-secondary)]">
                          {item.product_name}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">
                          {item.received_quantity}
                        </td>
                        <td className="px-2 py-1 text-right text-[var(--color-text-muted)]">
                          {location?.code || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-[var(--color-neutral-200)] px-4 py-2.5 text-sm font-medium text-[var(--color-neutral-600)] transition-all hover:bg-[var(--color-neutral-50)]"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleCompleteReceiving}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-[var(--color-status-transit-icon)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? copy.processing : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
