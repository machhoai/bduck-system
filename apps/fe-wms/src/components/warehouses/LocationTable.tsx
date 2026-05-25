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
          <h2 className="text-lg font-semibold text-gray-950">
            {t.warehouses.locationList}
          </h2>
          <p className="text-sm text-gray-500">
            {t.warehouses.locationListHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          {t.warehouses.addLocation}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : locations.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 py-12 text-center">
          <MapPinned size={42} className="mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900">
            {t.warehouses.emptyLocations}
          </h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.9fr_1fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 md:grid">
            <span>{t.warehouses.locationName}</span>
            <span>{t.warehouses.type}</span>
            <span>{t.warehouses.status}</span>
            <span className="text-right">{t.common.actions}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {locations.map((location) => (
              <div
                key={location.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_1fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-950">
                    {location.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {location.code}
                  </p>
                </div>
                <span className="text-sm text-gray-700">
                  {t.warehouses.types[location.type]}
                </span>
                <StatusBadge status={location.status} />
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(location)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    aria-label={t.common.edit}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(location)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
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
      ? "bg-emerald-50 text-emerald-700"
      : status === LocationStatus.QUARANTINE
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
