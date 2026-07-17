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
import { EmployeeManagementView } from "./EmployeeManagementView";
import { EmployeeProfileFormModal } from "./EmployeeProfileFormModal";
import {
  ensureWarehouseIncluded,
  filterWarehousesByScope,
  getPermissionScope,
} from "./employeeManagementScope";

export function EmployeeManagementPage() {
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
      loading: "Đang lưu hồ sơ nhân viên...",
      success: "Đã lưu hồ sơ nhân viên.",
      error: (error: unknown) =>
        error instanceof Error
          ? error.message
          : "Không thể lưu hồ sơ nhân viên.",
      action: {
        error: { label: "Thử lại", onClick: () => void handleSave(payload) },
      },
    });
  };
  const handleDelete = async (profile: EmployeeProfile) => {
    if (!confirm(`Xóa mềm hồ sơ nhân viên?\n${profile.full_name}`)) return;
    await gooeyToast.promise(profileState.deleteProfile(profile.id), {
      loading: "Đang xóa hồ sơ nhân viên...",
      success: "Đã xóa hồ sơ nhân viên.",
      error: (error: unknown) =>
        error instanceof Error
          ? error.message
          : "Không thể xóa hồ sơ nhân viên.",
      action: {
        error: { label: "Thử lại", onClick: () => void handleDelete(profile) },
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
          <h1 className="mt-3 text-base font-semibold">
            Không có quyền truy cập hồ sơ nhân viên
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Tài khoản cần quyền employees.read để mở trang này.
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
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
      />
    </>
  );
}
