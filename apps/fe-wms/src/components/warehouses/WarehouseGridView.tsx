"use client";

import Link from "next/link";
import {
  Edit3,
  MapPin,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { Warehouse, WarehouseLocation } from "@bduck/shared-types";
import { ActiveStatus } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { groupWarehousesByType } from "@/utils/warehouseGrouping";
import { WarehouseGroupHeading } from "./WarehouseGroupHeading";

interface WarehouseGridViewProps {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
}

export function WarehouseGridView({
  warehouses,
  locations,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: WarehouseGridViewProps) {
  const { t } = useTranslation();

  const locationCounts = locations.reduce<Record<string, number>>(
    (acc, location) => {
      acc[location.warehouse_id] = (acc[location.warehouse_id] || 0) + 1;
      return acc;
    },
    {},
  );
  const warehouseGroups = groupWarehousesByType(warehouses);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
            {t.warehouses.warehouseList}
          </h2>
          <p className="text-sm text-gray-500">
            {t.warehouses.warehouseListHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.warehouses.addNew}
        </button>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : warehouses.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <WarehouseIcon
            size={42}
            className="mb-3 text-[var(--color-text-muted)]"
          />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.warehouses.empty}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.warehouses.emptyHint}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {warehouseGroups.map((group) => (
            <section key={group.type} className="space-y-3">
              <WarehouseGroupHeading
                type={group.type}
                count={group.warehouses.length}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.warehouses.map((warehouse) => (
                  <WarehouseCard
                    key={warehouse.id}
                    warehouse={warehouse}
                    locationCount={locationCounts[warehouse.id] || 0}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function WarehouseCard({
  warehouse,
  locationCount,
  onEdit,
  onDelete,
}: {
  warehouse: Warehouse;
  locationCount: number;
  onEdit: (w: Warehouse) => void;
  onDelete: (w: Warehouse) => void;
}) {
  const { t } = useTranslation();
  const isActive = warehouse.status === ActiveStatus.ACTIVE;

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 transition-all hover:border-[var(--color-border-focus)]">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {warehouse.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
              {warehouse.code}
            </p>
          </div>
          <span
            className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              isActive
                ? "border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
                : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
            }`}
          >
            {t.warehouses.statuses[warehouse.status]}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
          <span className="rounded-full bg-[var(--color-surface-card)] px-2 py-0.5">
            {t.warehouses.types[warehouse.type]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-card)] px-2 py-0.5">
            <MapPin size={11} />
            {locationCount} {t.warehouses.locations.toLowerCase()}
          </span>
        </div>

        {warehouse.address && (
          <p className="mt-2.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {warehouse.address}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-soft)] pt-3">
        <Link
          href={`/warehouses/${warehouse.id}`}
          className="inline-flex h-8 items-center rounded-full border border-[var(--color-brand-primary)] px-3.5 text-xs font-normal text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
        >
          {t.warehouses.openDetail}
        </Link>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(warehouse)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
            aria-label={t.common.edit}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(warehouse)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
            aria-label={t.common.delete}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4"
        >
          <div className="mb-2 h-5 w-3/4 rounded skeleton-pulse" />
          <div className="mb-3 h-3 w-1/3 rounded skeleton-pulse" />
          <div className="mb-2 flex gap-2">
            <div className="h-5 w-16 rounded-full skeleton-pulse" />
            <div className="h-5 w-20 rounded-full skeleton-pulse" />
          </div>
          <div className="mt-4 border-t border-[var(--color-border-soft)] pt-3">
            <div className="h-8 w-20 rounded-full skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
