"use client";

import {
    Building2,
    LayoutGrid,
    List,
    Map as MapIcon,
    Warehouse as WarehouseIcon,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { gooeyToast } from "goey-toast";
import type { Organization, Warehouse } from "@bduck/shared-types";
import { OrganizationFormModal } from "@/components/organizations/OrganizationFormModal";
import { OrganizationTable } from "@/components/organizations/OrganizationTable";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { WarehouseGridView } from "@/components/warehouses/WarehouseGridView";
import { WarehouseMapView } from "@/components/warehouses/WarehouseMapView";
import { WarehouseTable } from "@/components/warehouses/WarehouseTable";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";

type WarehouseTab = "warehouses" | "organizations";
type ViewMode = "map" | "grid" | "list";

export default function WarehousesPage() {
    const { t } = useTranslation();
    const {
        warehouses,
        loading,
        createWarehouse,
        updateWarehouse,
        deleteWarehouse,
    } = useWarehouses();
    const {
        organizations,
        loading: organizationsLoading,
        createOrganization,
        updateOrganization,
        deleteOrganization,
    } = useOrganizations();
    const { locations, loading: locationsLoading } = useWarehouseLocations();
    const [activeTab, setActiveTab] = useState<WarehouseTab>("warehouses");
    const [viewMode, setViewMode] = useState<ViewMode>("map");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
        null,
    );
    const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
    const [editingOrganization, setEditingOrganization] =
        useState<Organization | null>(null);

    const handleAdd = () => {
        setEditingWarehouse(null);
        setIsModalOpen(true);
    };

    const handleEdit = (warehouse: Warehouse) => {
        setEditingWarehouse(warehouse);
        setIsModalOpen(true);
    };

    const handleDelete = async (warehouse: Warehouse) => {
        if (!confirm(`${t.warehouses.confirmDeleteWarehouse}\n${warehouse.name}`)) {
            return;
        }

        const deleteAction = async () => {
            await deleteWarehouse(warehouse.id);
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
                        onClick: () => void handleDelete(warehouse),
                    },
                },
            });
        } catch (error) {
            console.error("[WarehousesPage] delete error:", error);
        }
    };

    const handleSave = async (payload: unknown) => {
        if (editingWarehouse) {
            return updateWarehouse(editingWarehouse.id, payload);
        }

        return createWarehouse(payload);
    };

    const handleAddOrganization = () => {
        setEditingOrganization(null);
        setIsOrganizationModalOpen(true);
    };

    const handleEditOrganization = (organization: Organization) => {
        setEditingOrganization(organization);
        setIsOrganizationModalOpen(true);
    };

    const handleDeleteOrganization = async (organization: Organization) => {
        if (
            !confirm(`${t.organizations.confirmDelete}\n${organization.name}`)
        ) {
            return;
        }

        const deleteAction = async () => {
            await deleteOrganization(organization.id);
        };

        try {
            await gooeyToast.promise(deleteAction(), {
                loading: t.organizations.deleting,
                success: t.organizations.deleteSuccess,
                error: (error: unknown) =>
                    error instanceof Error ? error.message : t.organizations.deleteError,
                description: {
                    success: t.organizations.deleteSuccess,
                    error: t.organizations.deleteError,
                },
                action: {
                    error: {
                        label: t.common.retry,
                        onClick: () => void handleDeleteOrganization(organization),
                    },
                },
            });
        } catch (error) {
            console.error("[WarehousesPage] delete organization error:", error);
        }
    };

    const handleSaveOrganization = async (payload: unknown) => {
        if (editingOrganization) {
            return updateOrganization(editingOrganization.id, payload);
        }

        return createOrganization(payload);
    };

    return (
        <div className={`flex w-full flex-col gap-4 ${viewMode === "map" && activeTab === "warehouses" ? "h-full" : ""}`}>
            <header className="z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 pb-3 px-4">
                    <h1 className="font-[var(--font-display)] text-lg font-semibold leading-[1.1] tracking-normal text-[var(--color-text-primary)] lg:text-lg">
                        {t.warehouses.title}
                    </h1>
                    <p className="text-sm leading-1 text-[var(--color-text-secondary)]">
                        {t.warehouses.description}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* View mode switcher — only visible on warehouses tab */}
                    {activeTab === "warehouses" && (
                        <div className="flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-1">
                            <ViewModeButton
                                active={viewMode === "map"}
                                icon={<MapIcon size={16} />}
                                label={t.warehouses.viewMap}
                                onClick={() => setViewMode("map")}
                            />
                            <ViewModeButton
                                active={viewMode === "grid"}
                                icon={<LayoutGrid size={16} />}
                                label={t.warehouses.viewGrid}
                                onClick={() => setViewMode("grid")}
                            />
                            <ViewModeButton
                                active={viewMode === "list"}
                                icon={<List size={16} />}
                                label={t.warehouses.viewList}
                                onClick={() => setViewMode("list")}
                            />
                        </div>
                    )}

                    {/* Tab switcher */}
                    <div className="grid grid-cols-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-1">
                        <TabButton
                            active={activeTab === "warehouses"}
                            icon={<WarehouseIcon size={16} />}
                            label={t.warehouses.tabWarehouses}
                            onClick={() => setActiveTab("warehouses")}
                        />
                        <TabButton
                            active={activeTab === "organizations"}
                            icon={<Building2 size={16} />}
                            label={t.warehouses.tabOrganizations}
                            onClick={() => setActiveTab("organizations")}
                        />
                    </div>
                </div>
            </header>

            {activeTab === "warehouses" ? (
                <>
                    {viewMode === "map" && (
                        <WarehouseMapView
                            warehouses={warehouses}
                            loading={loading}
                            onAdd={handleAdd}
                        />
                    )}
                    {viewMode === "grid" && (
                        <WarehouseGridView
                            warehouses={warehouses}
                            locations={locations}
                            loading={loading || locationsLoading}
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    )}
                    {viewMode === "list" && (
                        <WarehouseTable
                            warehouses={warehouses}
                            locations={locations}
                            loading={loading || locationsLoading}
                            onAdd={handleAdd}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    )}
                </>
            ) : (
                <OrganizationTable
                    organizations={organizations}
                    warehouses={warehouses}
                    loading={organizationsLoading || loading}
                    onAdd={handleAddOrganization}
                    onEdit={handleEditOrganization}
                    onDelete={handleDeleteOrganization}
                />
            )}

            <WarehouseFormModal
                isOpen={isModalOpen}
                warehouse={editingWarehouse}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
            />

            <OrganizationFormModal
                isOpen={isOrganizationModalOpen}
                organization={editingOrganization}
                onClose={() => setIsOrganizationModalOpen(false)}
                onSave={handleSaveOrganization}
            />
        </div>
    );
}

function TabButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-8 min-w-28 items-center justify-center gap-2 rounded-full px-4 text-sm font-normal tracking-normal transition-all active:scale-95 ${active
                ? "bg-[var(--color-brand-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function ViewModeButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className={`inline-flex h-8 w-9 items-center justify-center rounded-full transition-all active:scale-95 ${active
                ? "bg-[var(--color-brand-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                }`}
        >
            {icon}
        </button>
    );
}
