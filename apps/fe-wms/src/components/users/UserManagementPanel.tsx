"use client";

import { useMemo, useState } from "react";
import { Edit3, Plus, Trash2, UserRound } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { UserStatus } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRoles } from "@/hooks/useRoles";
import { useUsers, type UserWithAssignments } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { UserFormModal } from "./UserFormModal";

export function UserManagementPanel() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const { users, isLoading, error, createUser, updateUser, deleteUser } =
    useUsers();
  const { roles } = useRoles();
  const { warehouses } = useWarehouses();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const canWrite = hasPermission("users.write");

  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [
        user.full_name,
        user.username,
        user.email,
        user.employee_id,
        user.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search, users]);

  const openCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserWithAssignments) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: unknown) => {
    const action = editingUser
      ? updateUser(editingUser.id, payload)
      : createUser(payload);

    await gooeyToast.promise(action, {
      loading: t.users.saving,
      success: t.users.saveSuccess,
      error: (saveError: unknown) =>
        saveError instanceof Error ? saveError.message : t.users.saveError,
      description: {
        success: t.users.saveSuccess,
        error: t.users.saveError,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void handleSave(payload),
        },
      },
    });
  };

  const handleDelete = async (user: UserWithAssignments) => {
    if (!confirm(`${t.users.confirmDelete}\n${user.full_name}`)) return;

    await gooeyToast.promise(deleteUser(user.id), {
      loading: t.users.deleting,
      success: t.users.deleteSuccess,
      error: (deleteError: unknown) =>
        deleteError instanceof Error ? deleteError.message : t.users.deleteError,
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void handleDelete(user),
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)] lg:text-[40px]">
            {t.users.title}
          </h1>
          <p className="mt-2 text-[17px] leading-[1.47] text-[var(--color-text-secondary)]">
            {t.users.description}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-[17px] text-white transition-all active:scale-95"
          >
            <Plus size={18} />
            {t.users.addUser}
          </button>
        )}
      </header>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t.users.search}
        className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
      />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent-error)] bg-white p-4 text-[var(--color-accent-error)]">
          {error}
        </div>
      )}

      {isLoading ? (
        <UserSkeleton />
      ) : filteredUsers.length === 0 ? (
        <EmptyState title={t.users.empty} hint={t.users.emptyHint} />
      ) : (
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white">
          {filteredUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              canWrite={canWrite}
              roleById={roleById}
              warehouseById={warehouseById}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      <UserFormModal
        isOpen={isModalOpen}
        user={editingUser}
        roles={roles}
        warehouses={warehouses}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

function UserRow({
  user,
  canWrite,
  roleById,
  warehouseById,
  onEdit,
  onDelete,
}: {
  user: UserWithAssignments;
  canWrite: boolean;
  roleById: Map<string, { name: string }>;
  warehouseById: Map<string, { name: string }>;
  onEdit: (user: UserWithAssignments) => void;
  onDelete: (user: UserWithAssignments) => void;
}) {
  const { t } = useTranslation();
  const activeAssignments = user.assignments.filter((item) => item.is_active);

  return (
    <div className="grid gap-3 border-b border-[var(--color-border-soft)] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px_110px_90px] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
          <UserRound size={19} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-semibold text-[var(--color-text-primary)]">
            {user.full_name}
          </span>
          <span className="block truncate text-sm text-[var(--color-text-muted)]">
            {user.username} - {user.email} - {user.employee_id}
          </span>
        </span>
      </div>
      <div className="min-w-0 text-sm text-[var(--color-text-secondary)]">
        {activeAssignments.length === 0
          ? t.users.noAssignments
          : activeAssignments.slice(0, 2).map((assignment) => (
              <span key={assignment.id} className="block truncate">
                {roleById.get(assignment.role_id)?.name || assignment.role_id}
                {" / "}
                {assignment.warehouse_id
                  ? warehouseById.get(assignment.warehouse_id)?.name ||
                    assignment.warehouse_id
                  : t.users.globalScope}
              </span>
            ))}
      </div>
      <StatusPill status={user.status} />
      {canWrite && (
        <div className="flex items-center gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all active:scale-95"
            aria-label={t.common.edit}
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(user)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all active:scale-95"
            aria-label={t.common.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: UserStatus }) {
  const { t } = useTranslation();
  const tone =
    status === UserStatus.ACTIVE
      ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)]"
      : status === UserStatus.SUSPENDED
        ? "border-[var(--color-accent-warning)] text-[var(--color-accent-warning)]"
        : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)]";

  return (
    <span className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${tone}`}>
      {t.users.statuses[status]}
    </span>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white px-4 py-12 text-center">
      <UserRound size={42} className="mb-3 text-[var(--color-text-muted)]" />
      <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="mt-1 text-[17px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function UserSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <Skeleton variant="circle" className="h-11 w-11" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-4 w-48" />
            <Skeleton variant="text" className="h-3 w-72" />
          </div>
        </div>
      ))}
    </div>
  );
}
