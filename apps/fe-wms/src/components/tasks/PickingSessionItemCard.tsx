"use client";

import { AlertTriangle, CheckCircle2, MapPin, ScanBarcode } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import TaskProductThumb from "./TaskProductThumb";

interface PickingSessionItem {
  id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  product_image_url: string | null;
  location_name: string;
  quantity: number;
  picked_quantity: number;
  notes: string;
}

interface PickingSessionItemCardProps {
  item: PickingSessionItem;
  isSubmitting: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onNotesChange: (itemId: string, notes: string) => void;
}

export default function PickingSessionItemCard({
  item,
  isSubmitting,
  onQuantityChange,
  onNotesChange,
}: PickingSessionItemCardProps) {
  const { t } = useTranslation();
  const isOverPicked = item.picked_quantity > item.quantity;
  const isReady = item.quantity > 0 && item.picked_quantity === item.quantity;
  const isPending = item.picked_quantity === 0;
  const productName = item.product_name || t.common.noData;
  const sku = item.product_code || t.common.noData;
  const locationName = item.location_name || t.common.noData;
  const progress =
    item.quantity > 0 ? Math.min(Math.round((item.picked_quantity / item.quantity) * 100), 100) : 0;
  const discrepancy = item.picked_quantity - item.quantity;

  const statusMeta = isOverPicked
    ? {
        label: t.pickingSession.overPicked,
        tone:
          "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
        icon: <AlertTriangle className="h-4 w-4" />,
      }
    : isReady
      ? {
          label: t.pickingSession.ready,
          tone:
            "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text-strong)]",
          icon: <CheckCircle2 className="h-4 w-4" />,
        }
      : isPending
        ? {
            label: t.pickingSession.pending,
            tone:
              "border-[var(--color-border-soft)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]",
            icon: <MapPin className="h-4 w-4" />,
          }
        : {
            label: t.pickingSession.shortage,
            tone:
              "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/60 text-[var(--color-status-pending-text)]",
            icon: <AlertTriangle className="h-4 w-4" />,
          };

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isOverPicked
          ? "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/40"
          : "border-[var(--color-border-soft)] bg-white shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <TaskProductThumb
          imageUrl={item.product_image_url}
          name={productName}
          sku={sku}
          className="h-[4.5rem] w-[4.5rem]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {productName}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {t.tasks.detail.sku}: {sku}
                </span>
                {item.product_barcode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-primary-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand-primary)]">
                    <ScanBarcode className="h-3 w-3" />
                    {item.product_barcode}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.tone}`}
            >
              {statusMeta.icon}
              {statusMeta.label}
            </div>
          </div>

          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{locationName}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]">
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.pickingSession.requested}
          </label>
          <div className="text-xl font-semibold text-[var(--color-text-primary)]">
            {item.quantity}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.pickingSession.picked}
          </label>
          <input
            type="number"
            value={item.picked_quantity || ""}
            onChange={(event) =>
              onQuantityChange(item.id, Math.max(0, Number(event.target.value)))
            }
            min={0}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition-colors focus:ring-2 ${
              isOverPicked
                ? "border-[var(--color-status-pending-border)] text-[var(--color-status-pending-text)] focus:border-[var(--color-status-pending-icon)] focus:ring-[var(--color-status-pending-bg-muted)]"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:ring-[var(--color-brand-primary-muted)]"
            }`}
          />
        </div>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.receiving.diff}
          </label>
          <div
            className={`rounded-lg px-2 py-2 text-center text-base font-bold ${
              discrepancy === 0
                ? "bg-[var(--color-success-bg-muted)] text-[var(--color-success-text-strong)]"
                : discrepancy > 0
                  ? "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]"
                  : "bg-[var(--color-error-bg-muted)] text-[var(--color-error-text)]"
            }`}
          >
            {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="font-medium text-[var(--color-text-secondary)]">
            {t.pickingSession.progressLabel}
          </span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {item.picked_quantity} / {item.quantity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
          <div
            className={`h-full rounded-full transition-all ${
              isOverPicked
                ? "bg-[var(--color-status-pending-icon)]"
                : "bg-[var(--color-brand-primary)]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-muted)]">
          {t.tasks.detail.notes}
        </label>
        <textarea
          value={item.notes}
          onChange={(event) => onNotesChange(item.id, event.target.value)}
          placeholder={t.pickingSession.notesPlaceholder}
          disabled={isSubmitting}
          rows={2}
          className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
        />
      </div>
    </div>
  );
}
