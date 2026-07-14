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
import { WarehouseTableSkeleton } from "./WarehouseSkeleton";

interface WarehouseTableProps {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
}

export function WarehouseTable({
  warehouses,
  locations,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: WarehouseTableProps) {
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
        <WarehouseTableSkeleton />
      ) : warehouses.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <WarehouseIcon size={42} className="mb-3 text-[var(--color-text-muted)]" />
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
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="hidden grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_1fr] gap-4 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-3 text-xs font-semibold uppercase text-[var(--color-text-muted)] md:grid">
                  <span>{t.warehouses.name}</span>
                  <span>{t.warehouses.type}</span>
                  <span>{t.warehouses.status}</span>
                  <span>{t.warehouses.locations}</span>
                  <span className="text-right">{t.common.actions}</span>
                </div>
                <div className="divide-y divide-[var(--color-border-soft)]">
                  {group.warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_1fr] md:items-center md:gap-4"
                    >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {warehouse.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                    {warehouse.code}
                    {warehouse.address ? ` · ${warehouse.address}` : ""}
                  </p>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {t.warehouses.types[warehouse.type]}
                </span>
                <StatusBadge status={warehouse.status} />
                <div className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <MapPin size={15} className="text-[var(--color-text-muted)]" />
                  {locationCounts[warehouse.id] || 0}
                </div>
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <Link
                    href={`/warehouses/${warehouse.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--color-brand-primary)] bg-white px-3 text-sm font-normal text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                  >
                    {t.warehouses.openDetail}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onEdit(warehouse)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                    aria-label={t.common.edit}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(warehouse)}
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
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: ActiveStatus }) {
  const { t } = useTranslation();
  const isActive = status === ActiveStatus.ACTIVE;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${isActive
          ? "border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
          : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
        }`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
