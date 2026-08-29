"use client";

import type { RevenueOrderItem, SoldOrderGoodsItem } from "@bduck/shared-types";
import { ChevronDown, ListFilter, ReceiptText } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";

import RevenueOrderTabs from "./RevenueOrderTabs";

interface RevenueOrderExplorerProps {
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
}

export default function RevenueOrderExplorer({
  orders,
  soldItems,
}: RevenueOrderExplorerProps) {
  const { t } = useTranslation();
  const copy = t.revenue.orders;
  const [expanded, setExpanded] = useState(false);
  const summary = copy.summary
    .replace("{orders}", String(orders.length))
    .replace("{items}", String(soldItems.length));

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="revenue-order-details"
        onClick={() => setExpanded((current) => !current)}
        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--color-surface-card)] sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-blue-50 text-blue-700">
            <ReceiptText size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[var(--color-text-primary)]">
              {copy.title}
            </span>
            <span className="mt-0.5 block truncate text-xxs text-[var(--color-text-muted)]">
              {expanded ? copy.expandedHint : copy.collapsedHint}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden rounded-full bg-[var(--color-surface-card)] px-3 py-1.5 text-xxs font-bold tabular-nums text-[var(--color-text-secondary)] sm:inline-flex sm:items-center sm:gap-1.5">
            <ListFilter size={12} aria-hidden="true" />
            {summary}
          </span>
          <span className="text-xs font-bold text-[var(--color-brand-primary)]">
            {expanded ? copy.hideDetails : copy.showDetails}
          </span>
          <ChevronDown
            size={17}
            aria-hidden="true"
            className={`text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {expanded && (
        <div
          id="revenue-order-details"
          className="border-t border-[var(--color-border-soft)]"
        >
          <RevenueOrderTabs orders={orders} soldItems={soldItems} />
        </div>
      )}
    </section>
  );
}
