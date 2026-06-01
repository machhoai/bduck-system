"use client";

/**
 * ReceiveTransferPanel — Panel for receiving INTER-warehouse transfer items
 *
 * This panel is shown when a transfer order is in PENDING_RECEIVE or RECEIVING status.
 * The user at the destination warehouse selects a location for each item and confirms receipt.
 *
 * ARCHITECTURAL REFINEMENT: Each item MUST have a destination_location_id selected.
 * LUẬT THÉP: gooeyToast.promise, confirmation dialog, disable on submit.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowDownRight,
  CheckCircle2,
  MapPin,
  Package,
  AlertTriangle,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { TransferOrder } from "@bduck/shared-types";
import { TransferOrderStatus } from "@bduck/shared-types";
import { useWarehouseLocations } from "../../../hooks/useWarehouses";
import { useProducts } from "../../../hooks/useProducts";
import {
  startReceiving,
  completeReceiving,
} from "../../../hooks/useTransferOrderApi";
import { useWarehouses } from "../../../hooks/useWarehouses";

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

export default function ReceiveTransferPanel({ order, orderItems, onCompleted }: Props) {
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

  // Initialize items from order items prop
  useEffect(() => {
    if (!orderItems || orderItems.length === 0 || items.length > 0) return;
    setItems(
      orderItems.map((oi) => {
        const product = products.find((p) => p.id === oi.product_id);
        return {
          item_id: oi.id,
          product_id: oi.product_id,
          product_name: product?.name || oi.product_id,
          expected_quantity: oi.quantity,
          received_quantity: oi.quantity,
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
      (item) =>
        item.destination_location_id !== "" &&
        item.received_quantity > 0,
    );
  }, [items]);

  const isPendingReceive =
    order.status === TransferOrderStatus.PENDING_RECEIVE;
  const isReceiving = order.status === TransferOrderStatus.RECEIVING;

  // Step 1: Start receiving (changes status to RECEIVING)
  const handleStartReceiving = async () => {
    try {
      await gooeyToast.promise(startReceiving(order.id), {
        loading: "Đang bắt đầu nhận hàng...",
        success: "Đã bắt đầu nhận hàng",
        error: "Lỗi khi bắt đầu nhận hàng",
        description: {
          success: "Bạn có thể kiểm đếm và xác nhận từng mặt hàng.",
          error: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
        },
        action: {
          error: { label: "Thử lại", onClick: () => handleStartReceiving() },
        },
      });
    } catch {
      // Toast handles
    }
  };

  // Step 2: Complete receiving
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
        loading: "Đang xác nhận nhận hàng...",
        success: "Nhận hàng hoàn tất",
        error: "Lỗi khi nhận hàng",
        description: {
          success: "Hàng hóa đã được nhập vào kho đích.",
          error: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
        },
        action: {
          error: {
            label: "Thử lại",
            onClick: () => handleCompleteReceiving(),
          },
        },
      });
      onCompleted?.();
    } catch {
      // Toast handles
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white">
          <ArrowDownRight size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-teal-800">
            Nhận hàng điều chuyển
          </h3>
          <p className="text-xs text-teal-600">
            {srcWarehouse?.name || "Kho nguồn"} →{" "}
            {destWarehouse?.name || "Kho đích"}
          </p>
        </div>
        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
          {order.order_number}
        </span>
      </div>

      {/* PENDING_RECEIVE: Show "Start Receiving" button */}
      {isPendingReceive && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 py-8">
          <Package size={32} className="text-gray-400" />
          <p className="text-sm text-gray-600">
            Hàng đã đến kho đích. Bấm để bắt đầu kiểm nhận.
          </p>
          <button
            type="button"
            onClick={handleStartReceiving}
            className="flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-600"
          >
            <ArrowDownRight size={16} />
            Bắt đầu nhận hàng
          </button>
        </div>
      )}

      {/* RECEIVING: Show items with location selectors */}
      {isReceiving && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Chọn vị trí kho cho từng mặt hàng{" "}
              <span className="text-xs text-gray-400">
                ({items.length} sản phẩm)
              </span>
            </p>

            {items.map((item, idx) => {
              const product = products.find(
                (p) => p.id === item.product_id,
              );

              return (
                <div
                  key={item.item_id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  {/* Item header */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px] font-semibold text-teal-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {product?.code} · {product?.unit}
                    </span>
                  </div>

                  {/* Item fields */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Received quantity */}
                    <div>
                      <label className="mb-0.5 block text-[11px] text-gray-400">
                        SL nhận (Dự kiến: {item.expected_quantity})
                      </label>
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
                    </div>

                    {/* Destination location */}
                    <div>
                      <label className="mb-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                        <MapPin size={10} className="text-teal-500" />
                        Vị trí nhập kho *
                      </label>
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
                          !item.destination_location_id &&
                          !locLoading
                            ? "border-amber-300"
                            : "border-gray-200"
                        }`}
                      >
                        <option value="">
                          {locLoading
                            ? "Đang tải..."
                            : "— Chọn vị trí kho đích —"}
                        </option>
                        {destLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quantity mismatch warning */}
                  {item.received_quantity !== item.expected_quantity &&
                    item.received_quantity > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          SL nhận ({item.received_quantity}) khác với dự kiến (
                          {item.expected_quantity}).
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canSubmit || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-600 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {isSubmitting ? "Đang xác nhận..." : "Xác nhận nhận hàng"}
          </button>
        </>
      )}

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              Xác nhận nhận hàng?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Hàng hóa sẽ được nhập vào kho{" "}
              <strong>{destWarehouse?.name}</strong>. Hành động này không thể
              hoàn tác.
            </p>
            <div className="mt-4 max-h-32 overflow-y-auto rounded-lg border border-gray-100 text-xs">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-500">
                      Sản phẩm
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-500">
                      SL
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-500">
                      Vị trí
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const loc = destLocations.find(
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
                          {loc?.code || "—"}
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
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCompleteReceiving}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-600 disabled:opacity-50"
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
