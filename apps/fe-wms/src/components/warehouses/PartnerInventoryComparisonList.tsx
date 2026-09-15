"use client";

import type {
  PartnerInventoryComparisonRow,
  PartnerInventoryItemStatus,
  PartnerInventoryRowStatus,
  PartnerInventorySyncItemResult,
} from "@bduck/shared-types";
import type { ReactNode } from "react";

interface Copy {
  jpulse: string;
  partner: string;
  delta: string;
  status: string;
  statuses: Record<PartnerInventoryRowStatus, string>;
  itemStatuses: Record<PartnerInventoryItemStatus, string>;
}

const formatQuantity = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("vi-VN").format(value);

const Delta = ({ value }: { value: number | null }) => (
  <span
    className={
      value === null
        ? "text-[var(--color-text-muted)]"
        : value > 0
          ? "text-emerald-700"
          : value < 0
            ? "text-amber-700"
            : "text-[var(--color-text-muted)]"
    }
  >
    {value !== null && value > 0 ? "+" : ""}
    {formatQuantity(value)}
  </span>
);

const StatusBadge = ({
  row,
  copy,
}: {
  row: PartnerInventoryComparisonRow;
  copy: Copy;
}) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      row.eligible
        ? "bg-emerald-50 text-emerald-700"
        : row.status === "ALREADY_MATCHED"
          ? "bg-sky-50 text-sky-700"
          : "bg-amber-50 text-amber-800"
    }`}
  >
    {copy.statuses[row.status]}
  </span>
);

export function PartnerInventoryComparisonList({
  rows,
  selectedIds,
  onToggle,
  copy,
  selectionLimitReached = false,
  syncResults,
}: {
  rows: PartnerInventoryComparisonRow[];
  selectedIds: Set<string>;
  onToggle: (productId: string) => void;
  copy: Copy;
  selectionLimitReached?: boolean;
  syncResults?: Map<string, PartnerInventorySyncItemResult>;
}) {
  return (
    <>
      <div className="hidden overflow-auto rounded-2xl border border-[var(--color-border-subtle)] lg:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-[var(--color-neutral-50)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="w-12 px-3 py-3" />
              <th className="px-3 py-3">SKU / Product</th>
              <th className="px-3 py-3 text-right">{copy.jpulse}</th>
              <th className="px-3 py-3 text-right">{copy.partner}</th>
              <th className="px-3 py-3 text-right">{copy.delta}</th>
              <th className="px-3 py-3">{copy.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)] bg-white">
            {rows.map((row) => (
              <tr key={row.row_id} className="hover:bg-[var(--color-neutral-50)]">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`${row.sku} ${copy.status}`}
                    disabled={
                      !row.eligible ||
                      !row.product_id ||
                      (selectionLimitReached && !selectedIds.has(row.product_id))
                    }
                    checked={Boolean(row.product_id && selectedIds.has(row.product_id))}
                    onChange={() => row.product_id && onToggle(row.product_id)}
                    className="h-4 w-4 accent-[var(--color-brand-primary)]"
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[var(--color-text-primary)]">{row.sku}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{row.product_name}</p>
                </td>
                <td className="px-3 py-3 text-right font-semibold">{formatQuantity(row.jpulse_atp)}</td>
                <td className="px-3 py-3 text-right">{formatQuantity(row.partner_amount)}</td>
                <td className="px-3 py-3 text-right font-semibold"><Delta value={row.delta} /></td>
                <td className="px-3 py-3">
                  {syncResults?.get(row.sku) ? (
                    <SyncStatusBadge
                      status={syncResults.get(row.sku)!.status}
                      copy={copy}
                    />
                  ) : (
                    <StatusBadge row={row} copy={copy} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <label
            key={row.row_id}
            className={`block rounded-2xl border p-4 [contain-intrinsic-size:0_150px] [content-visibility:auto] ${
              row.eligible
                ? "border-[var(--color-border-subtle)] bg-white"
                : "border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`${row.sku} ${copy.status}`}
                disabled={
                  !row.eligible ||
                  !row.product_id ||
                  (selectionLimitReached && !selectedIds.has(row.product_id))
                }
                checked={Boolean(row.product_id && selectedIds.has(row.product_id))}
                onChange={() => row.product_id && onToggle(row.product_id)}
                className="mt-1 h-5 w-5 accent-[var(--color-brand-primary)]"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--color-text-primary)]">{row.sku}</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{row.product_name}</p>
              </div>
              {syncResults?.get(row.sku) ? (
                <SyncStatusBadge
                  status={syncResults.get(row.sku)!.status}
                  copy={copy}
                />
              ) : (
                <StatusBadge row={row} copy={copy} />
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Quantity label={copy.jpulse} value={formatQuantity(row.jpulse_atp)} />
              <Quantity label={copy.partner} value={formatQuantity(row.partner_amount)} />
              <Quantity label={copy.delta} value={<Delta value={row.delta} />} />
            </div>
          </label>
        ))}
      </div>
    </>
  );
}

function SyncStatusBadge({
  status,
  copy,
}: {
  status: PartnerInventoryItemStatus;
  copy: Copy;
}) {
  const successful = ["VERIFIED", "ALREADY_MATCHED"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        successful
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800"
      }`}
    >
      {copy.itemStatuses[status]}
    </span>
  );
}

function Quantity({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-neutral-50)] p-2">
      <p className="text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-1 font-semibold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
