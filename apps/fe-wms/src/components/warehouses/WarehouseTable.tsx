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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">
            {t.warehouses.warehouseList}
          </h2>
          <p className="text-sm text-gray-500">
            {t.warehouses.warehouseListHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          {t.warehouses.addNew}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : warehouses.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 py-12 text-center">
          <WarehouseIcon size={42} className="mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900">
            {t.warehouses.empty}
          </h3>
          <p className="mt-1 text-sm text-gray-500">{t.warehouses.emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_1fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 md:grid">
            <span>{t.warehouses.name}</span>
            <span>{t.warehouses.type}</span>
            <span>{t.warehouses.status}</span>
            <span>{t.warehouses.locations}</span>
            <span className="text-right">{t.common.actions}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_1fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-950">
                    {warehouse.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {warehouse.code}
                    {warehouse.address ? ` · ${warehouse.address}` : ""}
                  </p>
                </div>
                <span className="text-sm text-gray-700">
                  {t.warehouses.types[warehouse.type]}
                </span>
                <StatusBadge status={warehouse.status} />
                <div className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <MapPin size={15} className="text-gray-400" />
                  {locationCounts[warehouse.id] || 0}
                </div>
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <Link
                    href={`/warehouses/${warehouse.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {t.warehouses.openDetail}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onEdit(warehouse)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    aria-label={t.common.edit}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(warehouse)}
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

function StatusBadge({ status }: { status: ActiveStatus }) {
  const { t } = useTranslation();
  const isActive = status === ActiveStatus.ACTIVE;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
