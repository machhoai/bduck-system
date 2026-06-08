"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, Boxes, MapPin, MapPinned, PackageSearch } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { WarehouseLocation } from "@bduck/shared-types";

import { LocationFormModal } from "@/components/warehouses/LocationFormModal";
import { LocationCardGrid } from "@/components/warehouses/LocationCardGrid";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { WarehouseTableSkeleton } from "@/components/warehouses/WarehouseSkeleton";
import { WarehouseDetailHero } from "@/components/warehouses/WarehouseDetailHero";

import StatCardGrid from "@/components/inventory/StatCardGrid";
import StockDistributionChart from "@/components/inventory/StockDistributionChart";
import ImportExportChart from "@/components/inventory/ImportExportChart";
import { InventoryValueChart } from "@/components/inventory/InventoryValueChart";
import { WarehouseAuditCard } from "@/components/warehouses/WarehouseAuditCard";
import { WarehouseInventoryView } from "@/components/warehouses/WarehouseInventoryView";

import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useInventory } from "@/hooks/useInventory";
import { useProducts } from "@/hooks/useProducts";
import { useUsers } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";

import {
    computeInventoryValue,
    computeKPIs,
    computeProductTypeDistribution,
} from "@/utils/inventoryAggregation";

type PageTab = "overview" | "products" | "locations";

export default function WarehouseDetailPage() {
    const { t } = useTranslation();
    const params = useParams<{ id: string }>();
    const warehouseId = params.id;

    const {
        warehouses,
        loading: warehousesLoading,
        updateWarehouse,
    } = useWarehouses();
    const {
        locations,
        loading: locationsLoading,
        createLocation,
        updateLocation,
        deleteLocation,
    } = useWarehouseLocations(warehouseId);
    const { inventory, loading: invLoading } = useInventory();
    const { products, loading: prodLoading } = useProducts();
    const { users, isLoading: usersLoading } = useUsers();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] =
        useState<WarehouseLocation | null>(null);
    const [activeTab, setActiveTab] = useState<PageTab>("overview");
    const [inventoryTab, setInventoryTab] = useState<InventoryTab>("products");

    const warehouse = useMemo(
        () => warehouses.find((item) => item.id === warehouseId),
        [warehouses, warehouseId],
    );

    const kpis = useMemo(
        () => computeKPIs(inventory, warehouses, warehouseId),
        [inventory, warehouses, warehouseId],
    );

    const typeDistribution = useMemo(
        () => computeProductTypeDistribution(inventory, products, warehouseId),
        [inventory, products, warehouseId],
    );

    const inventoryValue = useMemo(
        () => computeInventoryValue(inventory, products, warehouseId),
        [inventory, products, warehouseId],
    );

    const managerName = useMemo(() => {
        if (!warehouse?.manager_id) {
            return t.warehouses.noManager;
        }

        const manager = users.find((user) => user.id === warehouse.manager_id);

        if (manager) {
            return manager.full_name || manager.username || manager.email;
        }

        return usersLoading ? t.common.loading : t.warehouses.unknownManager;
    }, [
        t.common.loading,
        t.warehouses.noManager,
        t.warehouses.unknownManager,
        users,
        usersLoading,
        warehouse,
    ]);

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
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
                {t.common.noData}
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col gap-5 pb-8 sm:gap-4">
            <div>
                <WarehouseDetailHero
                    warehouse={warehouse}
                    warehouseId={warehouseId}
                    managerName={managerName}
                    onEdit={() => setIsWarehouseModalOpen(true)}
                />
            </div>
            <div className="flex flex-col gap-3">
                <div className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("overview")}
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${activeTab === "overview"
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <BarChart3 size={18} />
                            {t.warehouses.overview}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("products")}
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${activeTab === "products"
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <PackageSearch size={18} />
                            {t.warehouses.inventory}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("locations")}
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${activeTab === "locations"
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            <MapPin size={18} />
                            {t.warehouses.locations}
                        </button>
                    </div>
                </div>

                {activeTab === "overview" && (
                    <div className="flex flex-col gap-4">
                        <StatCardGrid
                            kpis={kpis}
                            loading={false}
                            isAllWarehouses={false}
                            locationCount={locations.length}
                            onCardClick={() => { }}
                        />

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <StockDistributionChart data={typeDistribution} loading={false} />
                            <ImportExportChart warehouseId={warehouseId} />
                        </div>

                        <InventoryValueChart
                            data={inventoryValue}
                            loading={invLoading || prodLoading}
                        />
                        <WarehouseAuditCard warehouseId={warehouseId} />
                    </div>
                )}

                {activeTab === "products" && (
                    <div className="flex min-h-[400px] flex-col gap-4">
                        {/* <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                                    {t.warehouses.inventoryInWarehouse}
                                </h2>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    {t.warehouses.inventoryTabDescription}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
                                <button
                                    type="button"
                                    onClick={() => setInventoryTab("products")}
                                    className={`flex min-h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${inventoryTab === "products"
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    <Boxes size={16} />
                                    {t.warehouses.byProduct}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInventoryTab("locations")}
                                    className={`flex min-h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${inventoryTab === "locations"
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    <MapPinned size={16} />
                                    {t.warehouses.byLocation}
                                    <span
                                        className={`flex h-5 items-center justify-center rounded-full px-2 text-xxs font-bold ${inventoryTab === "locations"
                                            ? "bg-white/20 text-white"
                                            : "border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]"
                                            }`}
                                    >
                                        {locations.length}
                                    </span>
                                </button>
                            </div>
                        </div> */}

                        <WarehouseInventoryView
                            inventory={inventory}
                            products={products}
                            locations={locations}
                            warehouseId={warehouseId}
                            loading={invLoading || prodLoading}
                        />
                    </div>
                )}
                {activeTab === "locations" && (
                    <div className="flex min-h-[400px] flex-col gap-4">
                        {/* <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                                    {t.warehouses.inventoryInWarehouse}
                                </h2>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    {t.warehouses.inventoryTabDescription}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
                                <button
                                    type="button"
                                    onClick={() => setInventoryTab("products")}
                                    className={`flex min-h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${inventoryTab === "products"
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    <Boxes size={16} />
                                    {t.warehouses.byProduct}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInventoryTab("locations")}
                                    className={`flex min-h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${inventoryTab === "locations"
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                >
                                    <MapPinned size={16} />
                                    {t.warehouses.byLocation}
                                    <span
                                        className={`flex h-5 items-center justify-center rounded-full px-2 text-xxs font-bold ${inventoryTab === "locations"
                                            ? "bg-white/20 text-white"
                                            : "border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]"
                                            }`}
                                    >
                                        {locations.length}
                                    </span>
                                </button>
                            </div>
                        </div> */}

                        <LocationCardGrid
                            locations={locations}
                            inventory={inventory}
                            products={products}
                            loading={locationsLoading}
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </div>
                )}
            </div>


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
