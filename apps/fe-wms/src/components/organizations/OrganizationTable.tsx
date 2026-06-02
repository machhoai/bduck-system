"use client";

import {
  Building2,
  Edit3,
  MapPin,
  Plus,
  Trash2,
  Warehouse,
} from "lucide-react";
import type { Organization, Warehouse as WarehouseType } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { WarehouseTableSkeleton } from "@/components/warehouses/WarehouseSkeleton";

interface OrganizationTableProps {
  organizations: Organization[];
  warehouses: WarehouseType[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (organization: Organization) => void;
  onDelete: (organization: Organization) => void;
}

export function OrganizationTable({
  organizations,
  warehouses,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: OrganizationTableProps) {
  const { t } = useTranslation();
  const warehouseCounts = warehouses.reduce<Record<string, number>>(
    (acc, warehouse) => {
      acc[warehouse.organization_id] = (acc[warehouse.organization_id] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
            {t.organizations.list}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.organizations.listHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.organizations.addNew}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : organizations.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <Building2 size={42} className="mb-3 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.organizations.empty}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.organizations.emptyHint}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <article
              key={organization.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]"
            >
              <div className="aspect-[16/9] bg-[var(--color-surface-card)]">
                {organization.organization_image_url ? (
                  <img
                    src={organization.organization_image_url}
                    alt={organization.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 size={44} className="text-[var(--color-text-muted)]" />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {organization.name}
                    </h3>
                    <p className="mt-1 truncate text-xs font-normal uppercase text-[var(--color-text-muted)]">
                      {organization.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(organization)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                      aria-label={t.common.edit}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(organization)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                      aria-label={t.common.delete}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Warehouse size={15} className="text-[var(--color-text-muted)]" />
                    <span>
                      {warehouseCounts[organization.id] || 0}{" "}
                      {t.organizations.warehouses}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-[var(--color-text-muted)]" />
                    <span>{organization.tax_code || t.organizations.noTaxCode}</span>
                  </div>
                  {organization.address && (
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className="text-[var(--color-text-muted)]" />
                      <span className="truncate">{organization.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
