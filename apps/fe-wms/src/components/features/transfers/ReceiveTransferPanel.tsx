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

const COPY = {
  title: "Nhận hàng điều chuyển",
  sourceFallback: "Kho nguồn",
  destinationFallback: "Kho đích",
  readyText:
    "Hàng đã đến kho đích. Bấm để bắt đầu kiểm nhận.",
  startReceiving: "Bắt đầu nhận hàng",
  chooseLocations: "Chọn vị trí kho cho từng mặt hàng",
  products: "sản phẩm",
  receivedQty: "SL nhận",
  expected: "Dự kiến",
  destinationLocation: "Vị trí nhập kho",
  loading: "Đang tải...",
  selectLocation: "Chọn vị trí kho đích",
  mismatch:
    "SL nhận ({received}) khác với dự kiến ({expected}).",
  confirmReceive: "Xác nhận nhận hàng",
  confirmQuestion: "Xác nhận nhận hàng?",
  confirmDesc:
    "Hàng hóa sẽ được nhập vào kho {warehouse}. Hành động này không thể hoàn tác.",
  product: "Sản phẩm",
  location: "Vị trí",
  cancel: "Hủy",
  confirm: "Xác nhận",
  processing: "Đang xử lý...",
  starting: "Đang bắt đầu nhận hàng...",
  started: "Đã bắt đầu nhận hàng",
  startError: "Lỗi khi bắt đầu nhận hàng",
  startedDesc:
    "Bạn có thể kiểm đếm và xác nhận từng mặt hàng.",
  completing: "Đang xác nhận nhận hàng...",
  completed: "Nhận hàng hoàn tất",
  completeError: "Lỗi khi nhận hàng",
  completedDesc:
    "Hàng hóa đã được nhập vào kho đích.",
  errorDesc: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
  retry: "Thử lại",
} as const;

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
        loading: COPY.starting,
        success: COPY.started,
        error: COPY.startError,
        description: {
          success: COPY.startedDesc,
          error: COPY.errorDesc,
        },
        action: {
          error: {
            label: COPY.retry,
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
      await gooeyToast.promise(submitAction(), {
        loading: COPY.completing,
        success: COPY.completed,
        error: COPY.completeError,
        description: {
          success: COPY.completedDesc,
          error: COPY.errorDesc,
        },
        action: {
          error: {
            label: COPY.retry,
            onClick: () => void handleCompleteReceiving(),
          },
        },
      });
      onCompleted?.();
    } catch {
      // Toast handles error.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white">
          <ArrowDownRight size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-teal-800">{COPY.title}</h3>
          <p className="text-xs text-teal-600">
            {srcWarehouse?.name || COPY.sourceFallback} {"->"}{" "}
            {destWarehouse?.name || COPY.destinationFallback}
          </p>
        </div>
        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xxs font-semibold text-teal-700">
          {order.order_number}
        </span>
      </div>

      {isPendingReceive && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 py-4">
          <Package size={32} className="text-gray-400" />
          <p className="text-sm text-gray-600">{COPY.readyText}</p>
          <button
            type="button"
            onClick={handleStartReceiving}
            className="flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-600"
          >
            <ArrowDownRight size={16} />
            {COPY.startReceiving}
          </button>
        </div>
      )}

      {isReceiving && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {COPY.chooseLocations}{" "}
              <span className="text-xs text-gray-400">
                ({items.length} {COPY.products})
              </span>
            </p>

            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.product_id);

              return (
                <div
                  key={item.item_id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-xxs font-semibold text-teal-600">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {product?.code} / {product?.unit}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-0.5 block text-xxs text-gray-400">
                        {COPY.receivedQty} ({COPY.expected}:{" "}
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
                        className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-teal-400"
                      />
                    </label>

                    <label>
                      <span className="mb-0.5 flex items-center gap-1 text-xxs text-gray-400">
                        <MapPin size={10} className="text-teal-500" />
                        {COPY.destinationLocation} *
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
                        className={`w-full rounded border bg-white px-2.5 py-2 text-xs outline-none focus:border-teal-400 disabled:opacity-50 ${
                          !item.destination_location_id && !locLoading
                            ? "border-amber-300"
                            : "border-gray-200"
                        }`}
                      >
                        <option value="">
                          {locLoading ? COPY.loading : COPY.selectLocation}
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
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xxs text-amber-700">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          {COPY.mismatch
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-600 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {isSubmitting ? COPY.completing : COPY.confirmReceive}
          </button>
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[500px] rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              {COPY.confirmQuestion}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {COPY.confirmDesc.replace(
                "{warehouse}",
                destWarehouse?.name || COPY.destinationFallback,
              )}
            </p>
            <div className="mt-4 max-h-32 overflow-y-auto rounded-lg border border-gray-100 text-xs">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-500">
                      {COPY.product}
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-500">
                      SL
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-500">
                      {COPY.location}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const location = destLocations.find(
                      (l) => l.id === item.destination_location_id,
                    );
                    return (
                      <tr key={item.item_id} className="border-t border-gray-50">
                        <td className="px-2 py-1 text-gray-700">
                          {item.product_name}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">
                          {item.received_quantity}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-500">
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
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
              >
                {COPY.cancel}
              </button>
              <button
                type="button"
                onClick={handleCompleteReceiving}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-600 disabled:opacity-50"
              >
                {isSubmitting ? COPY.processing : COPY.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
