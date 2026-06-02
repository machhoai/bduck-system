"use client";

import { Edit3, MapPinned, Plus, Trash2 } from "lucide-react";
import { LocationStatus } from "@bduck/shared-types";
import type { WarehouseLocation } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { WarehouseTableSkeleton } from "./WarehouseSkeleton";

interface LocationTableProps {
  locations: WarehouseLocation[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
}

export function LocationTable({
  locations,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: LocationTableProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
            {t.warehouses.locationList}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.warehouses.locationListHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.warehouses.addLocation}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : locations.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <MapPinned size={42} className="mb-3 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.warehouses.emptyLocations}
          </h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.9fr_1fr] gap-4 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-3 text-xs font-semibold uppercase text-[var(--color-text-muted)] md:grid">
            <span>{t.warehouses.locationName}</span>
            <span>{t.warehouses.type}</span>
            <span>{t.warehouses.status}</span>
            <span className="text-right">{t.common.actions}</span>
          </div>
          <div className="divide-y divide-[var(--color-border-soft)]">
            {locations.map((location) => (
              <div
                key={location.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_1fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {location.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                    {location.code}
                  </p>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {t.warehouses.types[location.type]}
                </span>
                <StatusBadge status={location.status} />
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(location)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                    aria-label={t.common.edit}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(location)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                    aria-label={t.common.delete}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: LocationStatus }) {
  const { t } = useTranslation();
  const classes =
    status === LocationStatus.ACTIVE
      ? "border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
      : status === LocationStatus.QUARANTINE
        ? "bg-[var(--color-surface-card)] text-[var(--color-accent-warning)]"
        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]";

  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
