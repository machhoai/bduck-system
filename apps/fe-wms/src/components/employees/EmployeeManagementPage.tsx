"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BriefcaseBusiness,
  Edit3,
  IdCard,
  Plus,
  Search,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEmployeeProfiles } from "@/hooks/useEmployeeProfiles";
import { useRoles } from "@/hooks/useRoles";
import { useUsers, type UserWithAssignments } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import {
  EmployeeProfileFormModal,
  profileStatusLabel,
} from "./EmployeeProfileFormModal";

export function EmployeeManagementPage() {
  const permissions = useUserStore((state) => state.permissions);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const {
    profiles,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
  } = useEmployeeProfiles();
  const { users } = useUsers();
  const { roles } = useRoles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [editingProfile, setEditingProfile] =
    useState<EmployeeProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canRead = hasPermission("employees.read");
  const canCreate = hasPermission("employees.write");
  const readScope = useMemo(
    () => getPermissionScope(permissions, "employees.read"),
    [permissions],
  );
  const writeScope = useMemo(
    () => getPermissionScope(permissions, "employees.write"),
    [permissions],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const readableWarehouses = useMemo(
    () => filterWarehousesByScope(warehouses, readScope),
    [readScope, warehouses],
  );
  const writableWarehouses = useMemo(
    () => filterWarehousesByScope(warehouses, writeScope),
    [warehouses, writeScope],
  );

  const visibleProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((profile) => isWarehouseInScope(profile.workplace_warehouse_id, readScope))
      .filter((profile) =>
        warehouseFilter === "ALL"
          ? true
          : profile.workplace_warehouse_id === warehouseFilter,
      )
      .filter((profile) =>
        statusFilter === "ALL" ? true : profile.status === statusFilter,
      )
      .filter((profile) => {
        if (!q) return true;
        const user = profile.user_id ? userById.get(profile.user_id) : null;
        const warehouse = warehouseById.get(profile.workplace_warehouse_id);
        return [
          profile.employee_code,
          profile.full_name,
          profile.email,
          profile.phone,
          profile.job_title,
          profile.department,
          warehouse?.name,
          user?.username,
          user?.email,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [
    profiles,
    readScope,
    search,
    statusFilter,
    userById,
    warehouseById,
    warehouseFilter,
  ]);

  const stats = useMemo(
    () => ({
      total: visibleProfiles.length,
      active: visibleProfiles.filter(
        (profile) => profile.status === EmployeeProfileStatus.ACTIVE,
      ).length,
      linked: visibleProfiles.filter((profile) => profile.user_id).length,
    }),
    [visibleProfiles],
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
      ? updateProfile(editingProfile.id, payload)
      : createProfile(payload);

    await gooeyToast.promise(action, {
      loading: "Đang lưu hồ sơ nhân viên...",
      success: "Đã lưu hồ sơ nhân viên.",
      error: (saveError: unknown) =>
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu hồ sơ nhân viên.",
    });
  };

  const handleDelete = async (profile: EmployeeProfile) => {
    if (!confirm(`Xóa mềm hồ sơ nhân viên?\n${profile.full_name}`)) return;

    await gooeyToast.promise(deleteProfile(profile.id), {
      loading: "Đang xóa hồ sơ nhân viên...",
      success: "Đã xóa hồ sơ nhân viên.",
      error: (deleteError: unknown) =>
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa hồ sơ nhân viên.",
    });
  };

  if (!canRead) {
    return (
      <div className="flex w-full flex-col gap-4 p-4">
        <section className="grid min-h-72 place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white p-4 text-center">
          <div className="grid max-w-[680px] gap-3">
            <IdCard
              size={42}
              className="mx-auto text-[var(--color-text-muted)]"
            />
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              Không có quyền truy cập hồ sơ nhân viên
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tài khoản của bạn cần quyền employees.read để mở trang này.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
            <IdCard size={14} />
            Hồ sơ nhân viên
          </div>
          <div className="grid gap-1">
            <h1 className="font-[var(--font-display)] text-lg font-semibold leading-tight tracking-normal text-[var(--color-text-primary)]">
              Quản lý nhân viên
            </h1>
            <p className="max-w-[960px] text-sm leading-6 text-[var(--color-text-secondary)]">
              Quản lý profile nhân sự, nơi làm việc chính theo warehouse và liên
              kết tài khoản đăng nhập của từng nhân viên.
            </p>
          </div>
        </div>
        {canCreate && writableWarehouses.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition-all active:scale-95"
          >
            <Plus size={16} />
            Tạo profile
          </button>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={IdCard}
          label="Profile hiển thị"
          value={stats.total}
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label="Đang làm việc"
          value={stats.active}
        />
        <MetricCard
          icon={UserRoundCheck}
          label="Đã liên kết tài khoản"
          value={stats.linked}
        />
      </section>

      <section className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="relative block">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, mã nhân viên, email, warehouse..."
              className="h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>
          <select
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value)}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="ALL">Tất cả warehouse</option>
            {readableWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.values(EmployeeProfileStatus).map((status) => (
              <option key={status} value={status}>
                {profileStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-error)] bg-white p-3 text-sm text-[var(--color-accent-error)]">
            {error}
          </div>
        )}

        {isLoading || warehousesLoading ? (
          <EmployeeSkeleton />
        ) : visibleProfiles.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] p-4 text-center">
            <div className="grid gap-2">
              <IdCard
                size={38}
                className="mx-auto text-[var(--color-text-muted)]"
              />
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Chưa có hồ sơ nhân viên phù hợp
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Thử đổi bộ lọc hoặc tạo profile đầu tiên cho warehouse của bạn.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            <table className="w-full min-w-[1080px] border-collapse bg-white text-left text-sm">
              <thead className="bg-[var(--color-surface-card)] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nhân viên</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ</th>
                  <th className="px-4 py-3 font-semibold">Nơi làm việc</th>
                  <th className="px-4 py-3 font-semibold">Tài khoản</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProfiles.map((profile) => (
                  <EmployeeRow
                    key={profile.id}
                    profile={profile}
                    user={profile.user_id ? userById.get(profile.user_id) : null}
                    warehouse={warehouseById.get(
                      profile.workplace_warehouse_id,
                    )}
                    canWrite={isWarehouseInScope(
                      profile.workplace_warehouse_id,
                      writeScope,
                    )}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
    </div>
  );
}

function EmployeeRow({
  profile,
  user,
  warehouse,
  canWrite,
  onEdit,
  onDelete,
}: {
  profile: EmployeeProfile;
  user: UserWithAssignments | null | undefined;
  warehouse: Warehouse | undefined;
  canWrite: boolean;
  onEdit: (profile: EmployeeProfile) => void;
  onDelete: (profile: EmployeeProfile) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t border-[var(--color-border-soft)]"
    >
      <td className="px-4 py-3">
        <div className="grid gap-1">
          <span className="font-semibold text-[var(--color-text-primary)]">
            {profile.full_name}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {profile.employee_code}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {[profile.job_title, profile.department].filter(Boolean).join(" / ") ||
              "-"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
        <div className="grid gap-1">
          <span>{profile.email || "-"}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {profile.phone || "-"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {warehouse?.name || profile.workplace_warehouse_id}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
        {user ? (
          <div className="grid gap-1">
            <span>{user.username}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {user.email}
            </span>
          </div>
        ) : (
          <span className="text-[var(--color-text-muted)]">Chưa liên kết</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={profile.status} />
      </td>
      <td className="px-4 py-3">
        {canWrite && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(profile)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all active:scale-95"
              aria-label="Sửa"
            >
              <Edit3 size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(profile)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all active:scale-95"
              aria-label="Xóa"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </td>
    </motion.tr>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
        <Icon size={18} />
      </span>
      <div className="grid gap-1">
        <span className="text-2xl font-semibold text-[var(--color-text-primary)]">
          {value}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function StatusPill({ status }: { status: EmployeeProfileStatus }) {
  const tone =
    status === EmployeeProfileStatus.ACTIVE
      ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)] bg-emerald-50"
      : status === EmployeeProfileStatus.ON_LEAVE
        ? "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)] bg-amber-50"
        : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] bg-white";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {profileStatusLabel(status)}
    </span>
  );
}

function EmployeeSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-4 md:grid-cols-[1fr_1fr_160px]"
        >
          <div className="grid gap-2">
            <Skeleton variant="text" className="h-4 w-48" />
            <Skeleton variant="text" className="h-3 w-32" />
          </div>
          <Skeleton variant="text" className="h-4 w-64" />
          <Skeleton variant="text" className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

type PermissionScope = { global: boolean; warehouseIds: Set<string> };

function getPermissionScope(
  permissions: Record<string, Record<string, unknown>>,
  action: string,
): PermissionScope {
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[action] === true) {
    return { global: true, warehouseIds: new Set() };
  }

  const warehouseIds = new Set(
    Object.entries(permissions)
      .filter(([scope, scopedPermissions]) => {
        if (scope === "global") return false;
        return (
          scopedPermissions["*"] === true || scopedPermissions[action] === true
        );
      })
      .map(([scope]) => scope),
  );

  return { global: false, warehouseIds };
}

function isWarehouseInScope(warehouseId: string, scope: PermissionScope) {
  return scope.global || scope.warehouseIds.has(warehouseId);
}

function filterWarehousesByScope(
  warehouses: Warehouse[],
  scope: PermissionScope,
) {
  return scope.global
    ? warehouses
    : warehouses.filter((warehouse) => scope.warehouseIds.has(warehouse.id));
}

function ensureWarehouseIncluded(
  warehouses: Warehouse[],
  warehouse: Warehouse | undefined,
) {
  if (!warehouse) return warehouses;
  if (warehouses.some((item) => item.id === warehouse.id)) return warehouses;
  return [...warehouses, warehouse];
}
