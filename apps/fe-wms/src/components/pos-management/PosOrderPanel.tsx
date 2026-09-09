"use client";

import type { PosOrderSummary } from "@bduck/shared-types";
import { Radio } from "lucide-react";
import { useState } from "react";

import { usePosOrders } from "@/hooks/usePosOrders";

import { PosOrderDetailOverlay } from "./PosOrderDetailOverlay";
import { PosOrderFilters } from "./PosOrderFilters";
import { PosOrderList, PosOrderListSkeleton } from "./PosOrderList";
import { usePosOrderCopy } from "./usePosOrderCopy";

export function PosOrderPanel({
  warehouseId,
  canRead,
  canCancelLocal,
  canRefundRemote,
}: {
  warehouseId: string;
  canRead: boolean;
  canCancelLocal: boolean;
  canRefundRemote: boolean;
}) {
  const copy = usePosOrderCopy();
  const [selectedOrder, setSelectedOrder] = useState<PosOrderSummary | null>(
    null,
  );
  const orders = usePosOrders(warehouseId, canRead);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{copy.title}</h2>
          <p className="text-xs text-slate-500">{copy.hint}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xxs font-bold text-emerald-700">
          <Radio size={12} className="animate-pulse" />
          {copy.realtime} · {orders.orders.length}
        </span>
      </div>

      <PosOrderFilters
        value={orders.filters}
        employees={orders.employeeOptions}
        onChange={orders.setFilters}
      />

      {orders.error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {orders.error}
        </p>
      ) : null}
      {orders.loading ? (
        <PosOrderListSkeleton />
      ) : (
        <PosOrderList orders={orders.orders} onSelect={setSelectedOrder} />
      )}
      {orders.hasMore ? (
        <div className="text-center">
          <button
            type="button"
            onClick={orders.loadMore}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
          >
            {copy.loadMore}
          </button>
        </div>
      ) : null}

      <PosOrderDetailOverlay
        warehouseId={warehouseId}
        selectedOrder={selectedOrder}
        canCancelLocal={canCancelLocal}
        canRefundRemote={canRefundRemote}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
