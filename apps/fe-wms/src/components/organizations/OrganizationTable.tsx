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
          <h2 className="text-lg font-semibold text-gray-950">
            {t.organizations.list}
          </h2>
          <p className="text-sm text-gray-500">{t.organizations.listHint}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          {t.organizations.addNew}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : organizations.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 py-12 text-center">
          <Building2 size={42} className="mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900">
            {t.organizations.empty}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t.organizations.emptyHint}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <article
              key={organization.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="aspect-[16/9] bg-gray-50">
                {organization.organization_image_url ? (
                  <img
                    src={organization.organization_image_url}
                    alt={organization.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 size={44} className="text-gray-300" />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-950">
                      {organization.name}
                    </h3>
                    <p className="mt-1 truncate text-xs font-medium uppercase text-gray-500">
                      {organization.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(organization)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      aria-label={t.common.edit}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(organization)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                      aria-label={t.common.delete}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Warehouse size={15} className="text-gray-400" />
                    <span>
                      {warehouseCounts[organization.id] || 0}{" "}
                      {t.organizations.warehouses}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-gray-400" />
                    <span>{organization.tax_code || t.organizations.noTaxCode}</span>
                  </div>
                  {organization.address && (
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className="text-gray-400" />
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
