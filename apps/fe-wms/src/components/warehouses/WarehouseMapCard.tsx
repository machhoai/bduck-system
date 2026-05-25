"use client";

import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import type { Warehouse } from "@bduck/shared-types";
import { ActiveStatus } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface WarehouseMapCardProps {
  warehouse: Warehouse;
  isSelected: boolean;
  onSelect: (warehouse: Warehouse) => void;
}

export function WarehouseMapCard({
  warehouse,
  isSelected,
  onSelect,
}: WarehouseMapCardProps) {
  const { t } = useTranslation();
  const hasCoordinate = warehouse.coordinate !== null;
  const isActive = warehouse.status === ActiveStatus.ACTIVE;

  return (
    <button
      type="button"
      onClick={() => onSelect(warehouse)}
      className={`w-full rounded-[var(--radius-lg)] border p-3.5 text-left transition-all active:scale-[0.98] ${
        isSelected
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-focus)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
            {warehouse.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
            {warehouse.code} · {t.warehouses.types[warehouse.type]}
          </p>
        </div>

        <span
          className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isActive
              ? "border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
              : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
          }`}
        >
          {t.warehouses.statuses[warehouse.status]}
        </span>
      </div>

      {warehouse.address && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
          <MapPin size={12} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{warehouse.address}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!hasCoordinate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-card)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              <Navigation size={10} />
              {t.warehouses.noCoordinate}
            </span>
          )}
        </div>

        <Link
          href={`/warehouses/${warehouse.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 items-center rounded-full border border-[var(--color-brand-primary)] px-3 text-xs font-normal text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
        >
          {t.warehouses.openDetail}
        </Link>
      </div>
    </button>
  );
}
