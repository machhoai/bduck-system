"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  MapPin,
  Pencil,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { Warehouse } from "@bduck/shared-types";

import { useTranslation } from "@/lib/i18n";

interface WarehouseDetailHeroProps {
  warehouse: Warehouse;
  warehouseId: string;
  managerName: string;
  onEdit: () => void;
}

export function WarehouseDetailHero({
  warehouse,
  warehouseId,
  managerName,
  onEdit,
}: WarehouseDetailHeroProps) {
  const { t } = useTranslation();
  const coordinate = warehouse.coordinate;
  const isActive = warehouse.status === "ACTIVE";

  return (
    <header className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-sm">
      <div className="grid min-h-[260px] grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="flex flex-col gap-5 p-4 sm:p-4">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="h-36 w-full shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] md:h-44 md:w-56">
              {warehouse.warehouse_image_url ? (
                <img
                  src={warehouse.warehouse_image_url}
                  alt={warehouse.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--color-brand-primary)]">
                  <WarehouseIcon size={42} strokeWidth={1.35} />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                    {warehouse.code}
                  </span>
                  <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                    {t.warehouses.types[warehouse.type]}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      isActive
                        ? "border-[var(--color-accent-success)] bg-[#257a3e14] text-[var(--color-accent-success)]"
                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {t.warehouses.statuses[warehouse.status]}
                  </span>
                </div>

                <div>
                  <h1 className="break-words font-[var(--font-display)] text-lg font-bold leading-tight text-[var(--color-text-primary)] sm:text-lg">
                    {warehouse.name}
                  </h1>
                  {warehouse.address && (
                    <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      <MapPin
                        className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]"
                        size={16}
                      />
                      <span>{warehouse.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {warehouse.warehouse_description && (
                <p className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {warehouse.warehouse_description}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InfoTile label={t.warehouses.code} value={warehouse.code} />
            <InfoTile
              label={t.warehouses.type}
              value={t.warehouses.types[warehouse.type]}
            />
            <InfoTile
              label={t.warehouses.status}
              value={t.warehouses.statuses[warehouse.status]}
            />
            <InfoTile
              label={t.warehouses.managerId}
              value={managerName}
            />
          </div>
        </div>

        <aside className="flex flex-col justify-between gap-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t.warehouses.quickActions}
              </p>
              <button
                type="button"
                onClick={onEdit}
                aria-label={t.warehouses.editWarehouse}
                className="inline-flex h-8 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-card)]"
              >
                <Pencil size={17} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionLink
                href={`/import-vouchers?warehouseId=${warehouseId}`}
                label={t.warehouses.import}
                tone="primary"
                icon={<ArrowDownToLine size={18} />}
              />
              <ActionLink
                href={`/export-vouchers?warehouseId=${warehouseId}`}
                label={t.warehouses.export}
                icon={<ArrowUpFromLine size={18} />}
              />
              <ActionLink
                href={`/transfers?warehouseId=${warehouseId}`}
                label={t.warehouses.transfer}
                icon={<ArrowRightLeft size={18} />}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
            <InfoRow
              label={t.warehouses.longitude}
              value={
                coordinate
                  ? coordinate.longitude.toFixed(6)
                  : t.warehouses.noCoordinate
              }
            />
            <InfoRow
              label={t.warehouses.latitude}
              value={
                coordinate
                  ? coordinate.latitude.toFixed(6)
                  : t.warehouses.noCoordinate
              }
            />
          </div>
        </aside>
      </div>
    </header>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-20 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-5 text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function ActionLink({
  href,
  label,
  icon,
  tone = "neutral",
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: "primary" | "neutral";
}) {
  return (
    <Link
      href={href}
      className={`flex h-8 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] ${
        tone === "primary"
          ? "bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)]"
          : "border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-card)]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
