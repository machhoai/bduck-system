"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Warehouse as WarehouseIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Pencil,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { WarehouseLocation } from "@bduck/shared-types";

// Existing Location Components
import { LocationFormModal } from "@/components/warehouses/LocationFormModal";
import { LocationCardGrid } from "@/components/warehouses/LocationCardGrid";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { WarehouseTableSkeleton } from "@/components/warehouses/WarehouseSkeleton";

// Dashboard Components
import StatCardGrid from "@/components/inventory/StatCardGrid";
import StockDistributionChart from "@/components/inventory/StockDistributionChart";
import { WarehouseAuditCard } from "@/components/warehouses/WarehouseAuditCard";
import { WarehouseInventoryTable } from "@/components/warehouses/WarehouseInventoryTable";

// Hooks
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useInventory } from "@/hooks/useInventory";
import { useProducts } from "@/hooks/useProducts";
import { useTranslation } from "@/lib/i18n";

// Utilities
import {
  computeKPIs,
  computeProductTypeDistribution,
} from "@/utils/inventoryAggregation";

export default function WarehouseDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  // ── Data hooks (real-time) ──
  const { warehouses, loading: warehousesLoading, updateWarehouse } =
    useWarehouses();
  const {
    locations,
    loading: locationsLoading,
    createLocation,
    updateLocation,
    deleteLocation,
  } = useWarehouseLocations(warehouseId);
  const { inventory, loading: invLoading } = useInventory();
  const { products, loading: prodLoading } = useProducts();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<WarehouseLocation | null>(null);

  // Tabs State
  const [activeTab, setActiveTab] = useState<"products" | "locations">(
    "products",
  );

  const warehouse = useMemo(
    () => warehouses.find((item) => item.id === warehouseId),
    [warehouses, warehouseId],
  );

  // Computed KPIs for THIS warehouse only
  const kpis = useMemo(
    () => computeKPIs(inventory, warehouses, warehouseId),
    [inventory, warehouses, warehouseId],
  );

  const typeDistribution = useMemo(
    () => computeProductTypeDistribution(inventory, products, warehouseId),
    [inventory, products, warehouseId],
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

  const handleSaveWarehouse = async (payload: unknown) => {
    return updateWarehouse(warehouseId, payload);
  };

  const isLoading = warehousesLoading || invLoading || prodLoading;

  if (isLoading) {
    return <WarehouseTableSkeleton />;
  }

  if (!warehouse) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-8 text-center text-sm text-[var(--color-text-muted)]">
        {t.common.noData}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-6">
      <div>
        <Link
          href="/warehouses"
          className="mb-3 inline-flex items-center gap-2 text-sm font-normal text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-hover)]"
        >
          <ArrowLeft size={16} />
          {t.warehouses.backToList}
        </Link>

        {/* ── Header & Quick Actions ── */}
        <header className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] text-[var(--color-brand-primary)]">
                {warehouse.warehouse_image_url ? (
                  <img
                    src={warehouse.warehouse_image_url}
                    alt={warehouse.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <WarehouseIcon size={24} strokeWidth={1.5} />
                )}
              </div>
              <div>
                <h1 className="font-[var(--font-display)] text-[28px] font-semibold leading-tight tracking-[-0.28px] text-[var(--color-text-primary)] lg:text-[34px]">
                  {warehouse.name}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span className="rounded-full bg-[var(--color-surface-card)] px-2 py-0.5 border border-[var(--color-border-subtle)] font-medium text-[var(--color-text-secondary)]">
                    {warehouse.code}
                  </span>
                  <span>{t.warehouses.types[warehouse.type]}</span>
                  <span>·</span>
                  <span
                    className={
                      warehouse.status === "ACTIVE"
                        ? "text-[var(--color-text-success)]"
                        : "text-[var(--color-text-muted)]"
                    }
                  >
                    {t.warehouses.statuses[warehouse.status]}
                  </span>
                </p>
                {warehouse.address && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                    <MapPin size={15} />
                    {warehouse.address}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(true)}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
              >
                <Pencil size={16} />
                {t.warehouses.editWarehouse}
              </button>
              <span className="text-sm font-medium text-[var(--color-text-secondary)] mr-2 hidden sm:inline-block">
                {t.warehouses.quickActions}:
              </span>
              <button
                disabled
                className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm opacity-50 cursor-not-allowed hover:opacity-50"
              >
                <ArrowDownToLine size={16} />
                {t.warehouses.import}
              </button>
              <button
                disabled
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm opacity-50 cursor-not-allowed hover:bg-[var(--color-surface-base)]"
              >
                <ArrowUpFromLine size={16} />
                {t.warehouses.export}
              </button>
              <button
                disabled
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-sm opacity-50 cursor-not-allowed hover:bg-[var(--color-surface-base)]"
              >
                <ArrowRightLeft size={16} />
                {t.warehouses.transfer}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* ── Stat Cards (Dashboard) ── */}
      <StatCardGrid
        kpis={kpis}
        loading={false}
        isAllWarehouses={false}
        locationCount={locations.length}
        onCardClick={() => {}}
      />

      {/* ── Charts & Audit Row (Dashboard) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <StockDistributionChart data={typeDistribution} loading={false} />
        <WarehouseAuditCard />
      </div>

      {/* ── Tabs for Detailed Tables ── */}
      <div className="mt-2 flex flex-col gap-4">
        <div className="flex border-b border-[var(--color-border-subtle)]">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "products"
                ? "border-b-2 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t.warehouses.tabProducts}
          </button>
          <button
            onClick={() => setActiveTab("locations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "locations"
                ? "border-b-2 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t.warehouses.tabLocations}
            <span className="flex h-5 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] px-2 text-[11px] font-bold border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
              {locations.length}
            </span>
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="min-h-[400px]">
          {activeTab === "products" && (
            <WarehouseInventoryTable
              inventory={inventory}
              products={products}
              warehouseId={warehouseId}
            />
          )}
          {activeTab === "locations" && (
            <LocationCardGrid
              locations={locations}
              inventory={inventory}
              products={products}
              loading={locationsLoading}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <LocationFormModal
        isOpen={isModalOpen}
        warehouseId={warehouseId}
        location={editingLocation}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLocation}
      />
      <WarehouseFormModal
        isOpen={isWarehouseModalOpen}
        warehouse={warehouse}
        onClose={() => setIsWarehouseModalOpen(false)}
        onSave={handleSaveWarehouse}
      />
    </div>
  );
}
