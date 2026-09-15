"use client";

import { ActiveStatus } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import {
  Building2,
  Compass,
  FileText,
  MapPin,
  Pencil,
  User,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

interface WarehouseInfoReadonlyViewProps {
  warehouse: Warehouse;
  managerName: string;
  canEdit: boolean;
  onEdit: () => void;
  t: Dictionary;
}

export function WarehouseInfoReadonlyView({
  warehouse,
  managerName,
  canEdit,
  onEdit,
  t,
}: WarehouseInfoReadonlyViewProps) {
  const isCoordinatesPresent =
    warehouse.coordinate &&
    warehouse.coordinate.latitude != null &&
    warehouse.coordinate.longitude != null;

  return (
    <div className="flex flex-col gap-3.5 pb-16 pt-1">
      {/* Hero Image Header */}
      {warehouse.warehouse_image_url ? (
        <div className="relative h-40 w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] shadow-xs">
          <img
            src={warehouse.warehouse_image_url}
            alt={warehouse.name}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)]">
          <Building2 size={28} strokeWidth={1.5} />
          <span className="mt-1 text-xxs font-normal">
            {t.warehouses.image || "Chưa có ảnh cơ sở"}
          </span>
        </div>
      )}

      {/* Hero Identity Card */}
      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {warehouse.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xxs font-semibold uppercase tracking-wider text-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] px-2 py-0.5 rounded-md border border-[var(--color-brand-primary)]/20">
                {warehouse.code}
              </span>
              <span className="rounded-md bg-[var(--color-neutral-100)] border border-[var(--color-neutral-200)] px-2 py-0.5 text-xxs font-medium text-[var(--color-neutral-700)]">
                {t.warehouses.types[warehouse.type]}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xxs font-medium border ${
                  warehouse.status === ActiveStatus.ACTIVE
                    ? "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]"
                    : "bg-[var(--color-neutral-100)] border-[var(--color-neutral-200)] text-[var(--color-neutral-600)]"
                }`}
              >
                {t.warehouses.statuses[warehouse.status]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dense Detail Information Cards */}
      <div className="space-y-2.5">
        {/* Operations: Manager & Address */}
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
              <User size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xxs font-medium text-[var(--color-text-muted)] block">
                {t.warehouses.managerId}
              </span>
              <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {managerName || t.warehouses.noManager}
              </p>
            </div>
          </div>

          {warehouse.address && (
            <div className="border-t border-[var(--color-border-soft)] pt-2 flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0 flex-1">
                <span className="text-xxs font-medium text-[var(--color-text-muted)] block">
                  {t.warehouses.address}
                </span>
                <p className="text-xs text-[var(--color-text-primary)] break-words font-medium">
                  {warehouse.address}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* GPS Coordinates */}
        {isCoordinatesPresent && (
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                  <Compass size={14} />
                </div>
                <div>
                  <span className="text-xxs font-medium text-[var(--color-text-muted)] block">
                    {t.warehouses.viewMap} (WGS84)
                  </span>
                  <p className="font-mono text-xs font-medium text-[var(--color-text-primary)]">
                    {warehouse.coordinate?.latitude}, {warehouse.coordinate?.longitude}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Description / Remarks */}
        {warehouse.warehouse_description && (
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText size={13} className="text-[var(--color-text-muted)]" />
              <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.warehouses.descriptionField}
              </span>
            </div>
            <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {warehouse.warehouse_description}
            </p>
          </div>
        )}
      </div>

      {/* Edit Trigger Button */}
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 text-xs font-medium text-white shadow-xs transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Pencil size={13} />
          <span>{t.warehouses.editWarehouse || "Chỉnh sửa cơ sở"}</span>
        </button>
      )}
    </div>
  );
}
