"use client";

import { useEffect, useState } from "react";
import { gooeyToast } from "goey-toast";
import type { Organization, Warehouse } from "@bduck/shared-types";
import { OrganizationFormModal } from "@/components/organizations/OrganizationFormModal";
import { OrganizationTable } from "@/components/organizations/OrganizationTable";
import { OfficeScopeOverviewPanel } from "@/components/office-scope/OfficeScopeOverviewPanel";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { WarehouseGridView } from "@/components/warehouses/WarehouseGridView";
import { WarehouseMapView } from "@/components/warehouses/WarehouseMapView";
import { WarehouseTable } from "@/components/warehouses/WarehouseTable";
import {
    FacilityPageHeader,
    type FacilityPageTab,
    type FacilityViewMode,
} from "@/components/warehouses/FacilityPageHeader";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";

export default function WarehousesPage() {
    const { t } = useTranslation();
    const canViewOfficeScopes = useUserStore((state) =>
        state.hasPermission("office_scopes.read"),
    );
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
    const [activeTab, setActiveTab] = useState<FacilityPageTab>("warehouses");
    const [viewMode, setViewMode] = useState<FacilityViewMode>("map");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
        null,
    );
    const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
    const [editingOrganization, setEditingOrganization] =
        useState<Organization | null>(null);

    useEffect(() => {
        if (!canViewOfficeScopes && activeTab === "officeScopes") {
            setActiveTab("warehouses");
        }
    }, [activeTab, canViewOfficeScopes]);

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

    const isMapView = viewMode === "map" && activeTab === "warehouses";

    return (
        <div className={isMapView ? "relative w-full h-full flex flex-col overflow-hidden" : "flex w-full flex-col gap-4"}>
            {isMapView && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    #wms-main-content > div.overflow-y-auto {
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    #wms-content-viewport {
                        min-height: 100% !important;
                        height: 100% !important;
                    }
                `}} />
            )}
            <FacilityPageHeader
                activeTab={activeTab}
                viewMode={viewMode}
                isMapView={isMapView}
                canViewOfficeScopes={canViewOfficeScopes}
                onTabChange={setActiveTab}
                onViewModeChange={setViewMode}
            />

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
            ) : activeTab === "officeScopes" ? (
                <OfficeScopeOverviewPanel facilities={warehouses} />
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
