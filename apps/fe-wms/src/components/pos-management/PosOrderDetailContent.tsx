import type {
  PosOrderCancelResult,
  PosOrderDetail,
  PosOrderRefundPreview,
} from "@bduck/shared-types";
import {
  CreditCard,
  FileText,
  Package,
  RefreshCw,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { PosOrderCancelSection } from "./PosOrderCancelSection";
import { PosOrderStatusBadge } from "./PosOrderStatusBadge";
import { usePosOrderCopy } from "./usePosOrderCopy";

interface Props {
  warehouseId: string;
  order: PosOrderDetail;
  preview: PosOrderRefundPreview | null;
  previewError: string | null;
  previewLoading: boolean;
  canCancelLocal: boolean;
  canRefundRemote: boolean;
  onCancelled: (result: PosOrderCancelResult) => void;
}

export function PosOrderDetailContent(props: Props) {
  const { order } = props;
  const copy = usePosOrderCopy();
  return (
    <div className="space-y-3 pb-4">
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xxs font-bold uppercase tracking-wide text-slate-400">
              {copy.orderInformation}
            </p>
            <p className="mt-1 break-all text-sm font-bold text-slate-900">
              {order.localOrderId}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PosOrderStatusBadge status={order.paymentStatus} />
            <PosOrderStatusBadge status={order.syncStatus} />
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
          <Detail label={copy.remoteId} value={order.hkOrderNumber} />
          <Detail label={copy.remoteUuid} value={order.remoteOrderId} />
          <Detail label={copy.createdAt} value={formatTime(order.createdAt)} />
          <Detail label={copy.paidAt} value={formatTime(order.paidAt)} />
          <Detail
            label={copy.total}
            value={formatMoney(order.totalAmount)}
            strong
          />
          <Detail
            label={copy.source}
            value={
              order.source === "JOYWORLD_IMPORT" ? copy.sourceImported : "JPOS"
            }
          />
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon={UserRound} title={copy.customer}>
          <Detail label={copy.customer} value={order.customerName} />
          <Detail label={copy.phone} value={order.customerPhone} />
          <Detail label={copy.memberCode} value={order.memberCode} />
          <Detail label={copy.cashier} value={order.operatorName} />
        </InfoCard>
        <InfoCard icon={CreditCard} title={copy.paymentMethod}>
          <Detail
            label={copy.paymentMethod}
            value={order.paymentMethodName || order.paymentMethod}
          />
          <Detail label={copy.device} value={order.deviceId} />
          <Detail label={copy.localId} value={order.id} />
        </InfoCard>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h3 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-900">
          <Package size={15} className="text-amber-600" />
          {copy.products}
        </h3>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div
              key={`${item.goodsId}:${item.goodsName}`}
              className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{item.goodsName}</p>
                <p className="mt-0.5 text-xxs text-slate-400">{item.goodsId}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">
                  {formatMoney(item.price * item.quantity)}
                </p>
                <p className="text-xxs text-slate-400">
                  {item.quantity} × {formatMoney(item.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon={RefreshCw} title={copy.syncHistory}>
          <Detail
            label={copy.retryCount}
            value={String(order.sync.retryCount)}
          />
          <Detail
            label={copy.syncTime}
            value={formatTime(order.sync.syncedAt)}
          />
          <Detail label={copy.operationId} value={order.sync.operationId} />
          <Detail label={copy.lastError} value={order.sync.lastError} danger />
        </InfoCard>
        <InfoCard icon={FileText} title={copy.invoice}>
          <Detail
            label={copy.invoiceStatus}
            value={order.invoice.status || copy.noInvoice}
          />
          <Detail
            label={copy.invoiceNumber}
            value={order.invoice.invoiceNumber}
          />
          <Detail label={copy.operationId} value={order.invoice.documentId} />
        </InfoCard>
      </section>

      <PosOrderCancelSection {...props} />
    </div>
  );
}

function Detail({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string | null;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xxs text-slate-400">{label}</dt>
      <dd
        className={`break-words ${strong ? "text-sm font-bold" : "font-semibold"} ${danger && value ? "text-red-600" : "text-slate-700"}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-900">
        <Icon size={15} className="text-amber-600" />
        {title}
      </h3>
      <dl className="grid gap-2">{children}</dl>
    </section>
  );
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
