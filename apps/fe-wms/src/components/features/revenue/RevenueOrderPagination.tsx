"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { getPaginationPages } from "./revenueOrderFilters";

const PAGE_SIZES = [10, 20, 50] as const;

interface RevenueOrderPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function RevenueOrderPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: RevenueOrderPaginationProps) {
  const { t } = useTranslation();
  const copy = t.revenue.orders.pagination;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);
  const pages = getPaginationPages(safePage, totalPages);

  return (
    <nav
      aria-label={copy.label}
      className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] pt-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <span className="text-xxs font-semibold tabular-nums text-[var(--color-text-muted)]">
          {copy.range
            .replace("{from}", String(firstItem))
            .replace("{to}", String(lastItem))
            .replace("{total}", String(totalItems))}
        </span>
        <label className="flex items-center gap-2 text-xxs font-semibold text-[var(--color-text-muted)]">
          <span className="hidden sm:inline">{copy.perPage}</span>
          <select
            aria-label={copy.perPage}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-2 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-center gap-1">
        <PageButton
          label={copy.previous}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </PageButton>
        {pages.map((pageNumber) => (
          <PageButton
            key={pageNumber}
            label={`${copy.page} ${pageNumber}`}
            active={pageNumber === safePage}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </PageButton>
        ))}
        <PageButton
          label={copy.next}
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight size={15} aria-hidden="true" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] px-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-[var(--color-brand-primary)] text-white"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
