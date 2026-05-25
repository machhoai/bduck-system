"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Edit3, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { Role } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRoles } from "@/hooks/useRoles";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { RoleFormModal } from "./RoleFormModal";

type ViewMode = "tree" | "board";
type BoardPosition = { x: number; y: number };
type TreeRole = { role: Role; depth: number };

function buildTree(
  roles: Role[],
  parentId: string | null = null,
  depth = 0,
): TreeRole[] {
  return roles
    .filter((role) => role.parent_id === parentId)
    .flatMap((role) => [
      { role, depth },
      ...buildTree(roles, role.id, depth + 1),
    ]);
}

export function RoleManagementPanel() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((s) => s.hasPermission);
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [positions, setPositions] = useState<Record<string, BoardPosition>>({});
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const treeRoles = useMemo(() => buildTree(roles), [roles]);
  const canWrite = hasPermission("roles.write");

  useEffect(() => {
    setPositions((current) => {
      const next = { ...current };
      roles.forEach((role, index) => {
        if (next[role.id]) return;
        next[role.id] = role.board_position || {
          x: 40 + (index % 4) * 220,
          y: 40 + Math.floor(index / 4) * 120,
        };
      });
      return next;
    });
  }, [roles]);

  const openCreate = () => {
    setEditingRole(null);
    setIsModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: unknown) => {
    const action = editingRole
      ? updateRole(editingRole.id, payload)
      : createRole(payload);

    await gooeyToast.promise(action, {
      loading: t.rbac.saving,
      success: t.rbac.saveSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : t.rbac.saveError,
      description: {
        success: t.rbac.saveSuccess,
        error: t.rbac.saveError,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void handleSave(payload),
        },
      },
    });
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`${t.rbac.confirmDelete}\n${role.name}`)) return;

    await gooeyToast.promise(deleteRole(role.id), {
      loading: t.rbac.deleting,
      success: t.rbac.deleteSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : t.rbac.deleteError,
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void handleDelete(role),
        },
      },
    });
  };

  const handlePointerDown = (event: PointerEvent, roleId: string) => {
    if (!canWrite) return;
    const boardRect = boardRef.current?.getBoundingClientRect();
    const position = positions[roleId];
    if (!boardRect || !position) return;

    setDragging({
      id: roleId,
      offsetX: event.clientX - boardRect.left - position.x,
      offsetY: event.clientY - boardRect.top - position.y,
    });
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    setPositions((current) => ({
      ...current,
      [dragging.id]: {
        x: Math.max(0, event.clientX - boardRect.left - dragging.offsetX),
        y: Math.max(0, event.clientY - boardRect.top - dragging.offsetY),
      },
    }));
  };

  const handlePointerUp = async () => {
    if (!dragging) return;
    const roleId = dragging.id;
    const nextPosition = positions[roleId];
    setDragging(null);
    if (!nextPosition) return;

    try {
      await updateRole(roleId, { board_position: nextPosition });
    } catch (error) {
      console.error("[RoleManagementPanel] update board position error:", error);
      gooeyToast.error(t.rbac.saveError, {
        description:
          error instanceof Error ? error.message : t.rbac.saveError,
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)] lg:text-[40px]">
            {t.rbac.title}
          </h1>
          <p className="mt-2 text-[17px] leading-[1.47] text-[var(--color-text-secondary)]">
            {t.rbac.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-full border border-[var(--color-border-subtle)] bg-white p-1">
            <ModeButton
              active={viewMode === "tree"}
              label={t.rbac.treeView}
              onClick={() => setViewMode("tree")}
            />
            <ModeButton
              active={viewMode === "board"}
              label={t.rbac.boardView}
              onClick={() => setViewMode("board")}
            />
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-[17px] text-white transition-all active:scale-95"
            >
              <Plus size={18} />
              {t.rbac.addRole}
            </button>
          )}
        </div>
      </header>

      {isLoading ? (
        <RoleSkeleton />
      ) : roles.length === 0 ? (
        <EmptyState title={t.rbac.noRoles} hint={t.rbac.noRolesHint} />
      ) : viewMode === "tree" ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white">
          {treeRoles.map(({ role, depth }) => (
            <RoleRow
              key={role.id}
              role={role}
              depth={depth}
              canWrite={canWrite}
              onEdit={openEdit}
              onDelete={handleDelete}
              permissionLabel={t.rbac.permissions}
              editLabel={t.common.edit}
              deleteLabel={t.common.delete}
            />
          ))}
        </div>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.rbac.boardHint}
          </p>
          <div
            ref={boardRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative h-[560px] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white"
          >
            {roles.map((role) => {
              const position = positions[role.id] || { x: 0, y: 0 };
              return (
                <button
                  key={role.id}
                  type="button"
                  onPointerDown={(event) => handlePointerDown(event, role.id)}
                  onDoubleClick={() => openEdit(role)}
                  className="absolute w-48 cursor-grab rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 text-left active:cursor-grabbing"
                  style={{
                    left: position.x,
                    top: position.y,
                    borderTop: `4px solid ${role.color}`,
                  }}
                >
                  <RoleCardContent
                    role={role}
                    permissionLabel={t.rbac.permissions}
                  />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <RoleFormModal
        isOpen={isModalOpen}
        role={editingRole}
        roles={roles}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-full px-4 text-sm transition-all active:scale-95 ${active
          ? "bg-[var(--color-brand-primary)] text-white"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
        }`}
    >
      {label}
    </button>
  );
}

function RoleRow({
  role,
  depth,
  canWrite,
  onEdit,
  onDelete,
  permissionLabel,
  editLabel,
  deleteLabel,
}: {
  role: Role;
  depth: number;
  canWrite: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  permissionLabel: string;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-3 last:border-b-0"
      style={{ paddingLeft: `${16 + depth * 28}px` }}
    >
      <RoleCardContent role={role} permissionLabel={permissionLabel} />
      {canWrite && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(role)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-all active:scale-95"
            aria-label={editLabel}
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(role)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all active:scale-95"
            aria-label={deleteLabel}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function RoleCardContent({
  role,
  permissionLabel,
}: {
  role: Role;
  permissionLabel: string;
}) {
  const permissionCount = Object.values(role.permissions || {}).filter(Boolean).length;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: role.color }}
      >
        <ShieldCheck size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold text-[var(--color-text-primary)]">
          {role.name}
        </span>
        <span className="block text-xs text-[var(--color-text-muted)]">
          {permissionCount} {permissionLabel}
        </span>
      </span>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white px-4 py-12 text-center">
      <ShieldCheck size={42} className="mb-3 text-[var(--color-text-muted)]" />
      <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="mt-1 text-[17px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function RoleSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <Skeleton variant="circle" className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-4 w-40" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
