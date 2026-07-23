"use client";

import { useMemo, useState } from "react";
import { IdCard } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { EmployeeProfile } from "@bduck/shared-types";
import { useEmployeeProfiles } from "@/hooks/useEmployeeProfiles";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import { useTranslation } from "@/lib/i18n";
import { EmployeeManagementView } from "./EmployeeManagementView";
import { EmployeeProfileFormModal } from "./EmployeeProfileFormModal";
import { EmployeeEmploymentModal } from "./EmployeeEmploymentModal";
import {
  ensureWarehouseIncluded,
  filterWarehousesByScope,
  getPermissionScope,
} from "./employeeManagementScope";

export function EmployeeManagementPage() {
  const { t } = useTranslation();
  const toasts = t.employeeManagement.toasts;
  const noAccess = t.employeeManagement.noAccess;
  const actions = t.employeeManagement.actions;

  const permissions = useUserStore((state) => state.permissions);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const profileState = useEmployeeProfiles();
  const { users } = useUsers();
  const { roles } = useRoles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employmentProfileId, setEmploymentProfileId] = useState<string | null>(
    null,
  );
  const employmentProfile =
    profileState.profiles.find(
      (profile) => profile.id === employmentProfileId,
    ) ?? null;
  const readScope = useMemo(
    () => getPermissionScope(permissions, "employees.read"),
    [permissions],
  );
  const writeScope = useMemo(
    () => getPermissionScope(permissions, "employees.write"),
    [permissions],
  );
  const writableWarehouses = useMemo(
    () => filterWarehousesByScope(warehouses, writeScope),
    [warehouses, writeScope],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((item) => [item.id, item])),
    [warehouses],
  );

  const openCreate = () => {
    setEditingProfile(null);
    setIsModalOpen(true);
  };
  const openEdit = (profile: EmployeeProfile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };
  const handleSave = async (payload: unknown) => {
    const action = editingProfile
      ? profileState.updateProfile(editingProfile.id, payload)
      : profileState.createProfile(payload);
    await gooeyToast.promise(action, {
      loading: toasts.savingLoading,
      success: toasts.savingSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : toasts.savingError,
      action: {
        error: { label: toasts.retry, onClick: () => void handleSave(payload) },
      },
    });
  };
  const handleDelete = async (profile: EmployeeProfile) => {
    const confirmText = actions.confirmDelete.replace(
      "{name}",
      profile.full_name,
    );
    if (!confirm(confirmText)) return;
    await gooeyToast.promise(profileState.deleteProfile(profile.id), {
      loading: toasts.deletingLoading,
      success: toasts.deletingSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : toasts.deletingError,
      action: {
        error: {
          label: toasts.retry,
          onClick: () => void handleDelete(profile),
        },
      },
    });
  };

  if (!hasPermission("employees.read")) {
    return (
      <div className="grid min-h-72 place-items-center p-4 text-center">
        <div>
          <IdCard
            size={42}
            className="mx-auto text-[var(--color-text-muted)]"
          />
          <h1 className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">
            {noAccess.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {noAccess.hint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-2">
      <EmployeeManagementView
        profiles={profileState.profiles}
        users={users}
        warehouses={warehouses}
        readScope={readScope}
        writeScope={writeScope}
        isLoading={profileState.isLoading || warehousesLoading}
        error={profileState.error}
        canCreate={
          hasPermission("employees.write") && writableWarehouses.length > 0
        }
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        canManageEmployment={(profile) =>
          hasPermission(
            "employees.employment.manage",
            profile.workplace_warehouse_id,
          )
        }
        onManageEmployment={(profile) => setEmploymentProfileId(profile.id)}
      />
      <EmployeeProfileFormModal
        isOpen={isModalOpen}
        profile={editingProfile}
        users={users}
        roles={roles}
        warehouses={
          editingProfile
            ? ensureWarehouseIncluded(
                writableWarehouses,
                warehouseById.get(editingProfile.workplace_warehouse_id),
              )
            : writableWarehouses
        }
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        canManageEmploymentAt={(workplaceId) =>
          Boolean(
            workplaceId &&
            hasPermission("employees.employment.manage", workplaceId),
          )
        }
      />
      <EmployeeEmploymentModal
        isOpen={Boolean(employmentProfile)}
        profile={employmentProfile}
        onClose={() => setEmploymentProfileId(null)}
      />
    </div>
  );
}
