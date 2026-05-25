"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { WarehouseLocation } from "@bduck/shared-types";
import { LocationFormModal } from "@/components/warehouses/LocationFormModal";
import { LocationTable } from "@/components/warehouses/LocationTable";
import { WarehouseTableSkeleton } from "@/components/warehouses/WarehouseSkeleton";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";

export default function WarehouseDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const {
    locations,
    loading: locationsLoading,
    createLocation,
    updateLocation,
    deleteLocation,
  } = useWarehouseLocations(warehouseId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<WarehouseLocation | null>(null);

  const warehouse = useMemo(
    () => warehouses.find((item) => item.id === warehouseId),
    [warehouses, warehouseId],
  );

  const handleAdd = () => {
    setEditingLocation(null);
    setIsModalOpen(true);
  };

  const handleEdit = (location: WarehouseLocation) => {
    setEditingLocation(location);
    setIsModalOpen(true);
  };

  const handleDelete = async (location: WarehouseLocation) => {
    if (!confirm(`${t.warehouses.confirmDeleteLocation}\n${location.name}`)) {
      return;
    }

    const deleteAction = async () => {
      await deleteLocation(location.id);
    };

    try {
      await gooeyToast.promise(deleteAction(), {
        loading: t.warehouses.deleting,
        success: t.warehouses.deleteSuccess,
        error: (error: unknown) =>
          error instanceof Error ? error.message : t.warehouses.deleteError,
        description: {
          success: t.warehouses.deleteSuccess,
          error: t.warehouses.deleteError,
        },
        action: {
          error: {
            label: t.common.retry,
            onClick: () => void handleDelete(location),
          },
        },
      });
    } catch (error) {
      console.error("[WarehouseDetailPage] delete location error:", error);
    }
  };

  const handleSaveLocation = async (payload: unknown) => {
    if (editingLocation) {
      return updateLocation(editingLocation.id, payload);
    }

    return createLocation(payload);
  };

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-5">
      <div>
        <Link
          href="/warehouses"
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-950"
        >
          <ArrowLeft size={16} />
          {t.warehouses.backToList}
        </Link>

        {warehousesLoading ? (
          <WarehouseTableSkeleton />
        ) : warehouse ? (
          <header className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <WarehouseIcon size={22} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-950">
                    {warehouse.name}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {warehouse.code} · {t.warehouses.types[warehouse.type]} ·{" "}
                    {t.warehouses.statuses[warehouse.status]}
                  </p>
                  {warehouse.address && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <MapPin size={15} />
                      {warehouse.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <span className="font-semibold">{locations.length}</span>{" "}
                {t.warehouses.locations}
              </div>
            </div>
          </header>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            {t.common.noData}
          </div>
        )}
      </div>

      <LocationTable
        locations={locations}
        loading={locationsLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <LocationFormModal
        isOpen={isModalOpen}
        warehouseId={warehouseId}
        location={editingLocation}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLocation}
      />
    </div>
  );
}
