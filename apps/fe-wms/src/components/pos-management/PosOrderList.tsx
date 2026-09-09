import type { PosOrderSummary } from "@bduck/shared-types";
import { ChevronRight, PackageOpen, UserRound } from "lucide-react";

import { PosOrderStatusBadge } from "./PosOrderStatusBadge";
import { usePosOrderCopy } from "./usePosOrderCopy";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
const time = (value: string) => new Date(value).toLocaleString("vi-VN");

export function PosOrderList({
  orders,
  onSelect,
}: {
  orders: PosOrderSummary[];
  onSelect: (order: PosOrderSummary) => void;
}) {
  const copy = usePosOrderCopy();
  if (orders.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
        <PackageOpen className="mb-2 text-slate-300" size={32} />
        <p className="text-xs font-medium text-slate-500">{copy.noOrders}</p>
      </div>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-slate-50 text-xxs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">{copy.orderCode}</th>
              <th className="px-3 py-2.5">{copy.customer}</th>
              <th className="px-3 py-2.5">{copy.payment}</th>
              <th className="px-3 py-2.5">{copy.sync}</th>
              <th className="px-3 py-2.5 text-right">{copy.total}</th>
              <th className="px-3 py-2.5">{copy.createdAt}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr
                key={order.id}
                tabIndex={0}
                onClick={() => onSelect(order)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onSelect(order);
                }}
                className="cursor-pointer bg-white transition hover:bg-amber-50/40 focus:bg-amber-50/60 focus:outline-none"
              >
                <td className="px-3 py-3">
                  <p className="font-bold text-slate-900">
                    {order.localOrderId}
                  </p>
                  <p className="mt-0.5 text-xxs text-slate-400">
                    {order.hkOrderNumber || "—"}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-700">
                    {order.customerName || "—"}
                  </p>
                  <p className="text-xxs text-slate-400">
                    {order.customerPhone || "—"}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <PosOrderStatusBadge status={order.paymentStatus} />
                </td>
                <td className="px-3 py-3">
                  <PosOrderStatusBadge status={order.syncStatus} />
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900">
                  {money(order.totalAmount)}
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {time(order.createdAt)}
                </td>
                <td className="pr-3 text-slate-400">
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xs active:bg-amber-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">
                  {order.localOrderId}
                </p>
                <p className="mt-0.5 truncate text-xxs text-slate-400">
                  {order.hkOrderNumber || "—"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-slate-900">
                {money(order.totalAmount)}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <PosOrderStatusBadge status={order.paymentStatus} />
              <PosOrderStatusBadge status={order.syncStatus} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xxs text-slate-500">
              <span className="flex min-w-0 items-center gap-1 truncate">
                <UserRound size={12} />
                {order.operatorName}
              </span>
              <span>{time(order.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

export function PosOrderListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-xl bg-slate-100 md:h-14"
        />
      ))}
    </div>
  );
}
