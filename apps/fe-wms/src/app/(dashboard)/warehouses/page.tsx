"use client";

import { Building2, Warehouse as WarehouseIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { gooeyToast } from "goey-toast";
import type { Organization, Warehouse } from "@bduck/shared-types";
import { OrganizationFormModal } from "@/components/organizations/OrganizationFormModal";
import { OrganizationTable } from "@/components/organizations/OrganizationTable";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { WarehouseTable } from "@/components/warehouses/WarehouseTable";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";

type WarehouseTab = "warehouses" | "organizations";

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
    <div className="mx-auto flex h-full w-full flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            {t.warehouses.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t.warehouses.description}
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
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
      </header>

      {activeTab === "warehouses" ? (
        <WarehouseTable
          warehouses={warehouses}
          locations={locations}
          loading={loading || locationsLoading}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
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
      className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
