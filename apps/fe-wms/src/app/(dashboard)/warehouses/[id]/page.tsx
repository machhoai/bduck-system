"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
    BarChart3,
    Boxes,
    MapPin,
    MapPinned,
    PackageSearch,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { LocationType, type WarehouseLocation } from "@bduck/shared-types";

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
import { useCategories } from "@/hooks/useCategories";
import { useLocationSlots } from "@/hooks/useLocationSlots";
import { useUsers } from "@/hooks/useUsers";
import { useExportVouchers } from "@/hooks/useExportVouchers";
import { useImportVouchers } from "@/hooks/useImportVouchers";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";

import {
    computeInventoryValue,
    computeKPIs,
    computeProductTypeDistribution,
} from "@/utils/inventoryAggregation";
import {
    buildWarehouseInventoryExportConfig,
    buildWarehouseMovementExportConfig,
} from "@/utils/warehouseMovementExport";
import type {
    ExportConfig,
    ExportRequestOptions,
    ExportSelectOption,
} from "@/utils/exportExcel";

type PageTab = "overview" | "products" | "locations";
type InventoryTab = "products" | "locations";

export default function WarehouseDetailPage() {
    const { t } = useTranslation();
    const params = useParams<{ id: string }>();
    const warehouseId = params.id;
    const hasPermission = useUserStore((state) => state.hasPermission);
    const canWriteLocations = hasPermission("locations.write", warehouseId);

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
    const { categories, isLoading: categoriesLoading } = useCategories();
    const { users, isLoading: usersLoading } = useUsers();
    const { slots, mappings: slotMappings } = useLocationSlots(warehouseId);
    const { allVouchers: importVouchers } = useImportVouchers();
    const {
        activeVouchers: activeExportVouchers,
        completedVouchers: completedExportVouchers,
    } = useExportVouchers();

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

    const exportVouchers = useMemo(
        () => [...activeExportVouchers, ...completedExportVouchers],
        [activeExportVouchers, completedExportVouchers],
    );

    const canViewPrice = hasPermission("products.price.view", warehouseId);
    const exportContext = useMemo(
        () => ({
            warehouseId,
            warehouseName: warehouse?.name ?? warehouseId,
            inventory,
            products,
            categories,
            locations,
            slots,
            slotMappings,
            importVouchers,
            exportVouchers,
            canViewPrice,
        }),
        [
            canViewPrice,
            categories,
            exportVouchers,
            importVouchers,
            inventory,
            locations,
            slotMappings,
            slots,
            products,
            warehouse?.name,
            warehouseId,
        ],
    );

    const warehouseExportFilterOptions = useMemo(() => {
        const uniqueOptions = (values: Array<string | null | undefined>) =>
            Array.from(new Set(values.filter(Boolean) as string[]))
                .sort((a, b) => a.localeCompare(b, "vi"))
                .map((value) => ({ value, label: value }));

        const counterLocations = locations.filter(
            (location) =>
                location.type === LocationType.COUNTER &&
                location.is_deleted !== true,
        );
        const counterLocationIds = new Set(
            counterLocations.map((location) => location.id),
        );

        return {
            categories: categories
                .filter((category) => category.is_deleted !== true)
                .map((category) => ({
                    value: category.id,
                    label: `${category.code} - ${category.name}`,
                })),
            locations: counterLocations.map((location) => ({
                value: location.id,
                label: `${location.code} - ${location.name}`,
            })),
            slots: slots
                .filter(
                    (slot) =>
                        slot.is_deleted !== true &&
                        counterLocationIds.has(slot.warehouse_location_id),
                )
                .map((slot) => ({
                    value: slot.id,
                    label: `${slot.code} - ${slot.name}`,
                    parentId: slot.warehouse_location_id,
                })),
            units: uniqueOptions(products.map((product) => product.unit)),
            materials: uniqueOptions(
                products.map((product) => product.product_material),
            ),
        } satisfies {
            categories: ExportSelectOption[];
            locations: ExportSelectOption[];
            slots: ExportSelectOption[];
            units: ExportSelectOption[];
            materials: ExportSelectOption[];
        };
    }, [categories, locations, products, slots]);

    const warehouseExportConfig = useMemo<ExportConfig | null>(() => {
        if (!warehouse) return null;

        return {
            ...buildWarehouseInventoryExportConfig(exportContext),
            dialog: {
                type: "warehouse" as const,
                title: "Xuất dữ liệu kho",
                description: warehouse.name,
                defaultOptions: {
                    dataKind: "movement" as const,
                    dateMode: "month" as const,
                    month: new Date().toISOString().slice(0, 7),
                },
                filterOptions: warehouseExportFilterOptions,
            },
            prepare: (options: ExportRequestOptions) => {
                if (options.dataKind === "inventory") {
                    return Promise.resolve(
                        buildWarehouseInventoryExportConfig(exportContext, options),
                    );
                }
                return buildWarehouseMovementExportConfig(exportContext, options);
            },
        };
    }, [exportContext, warehouse, warehouseExportFilterOptions]);

    useExportRegistration(warehouseExportConfig);

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
        if (!canWriteLocations) return;
        setEditingLocation(null);
        setIsModalOpen(true);
    };

    const handleEdit = (location: WarehouseLocation) => {
        if (!canWriteLocations) return;
        setEditingLocation(location);
        setIsModalOpen(true);
    };

    const handleDelete = async (location: WarehouseLocation) => {
        if (!canWriteLocations) return;
        if (
            !confirm(`${t.warehouses.confirmDeleteLocation}\n${location.name}`)
        ) {
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
                    error instanceof Error
                        ? error.message
                        : t.warehouses.deleteError,
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
            console.error(
                "[WarehouseDetailPage] delete location error:",
                error,
            );
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

    const isLoading =
        warehousesLoading || invLoading || prodLoading || categoriesLoading;

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
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
                                activeTab === "overview"
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
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
                                activeTab === "products"
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
                            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
                                activeTab === "locations"
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
                            onCardClick={() => {}}
                        />

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <StockDistributionChart
                                data={typeDistribution}
                                loading={false}
                            />
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
                        <LocationCardGrid
                            warehouseId={warehouseId}
                            locations={locations}
                            inventory={inventory}
                            products={products}
                            loading={locationsLoading}
                            canWrite={canWriteLocations}
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
