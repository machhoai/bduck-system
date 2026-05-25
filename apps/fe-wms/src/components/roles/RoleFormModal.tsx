"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { X } from "lucide-react";
import type { Role } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

const PERMISSIONS = [
  "*",
  "roles.read",
  "roles.write",
  "audit.read",
  "users.read",
  "users.write",
  "warehouses.read",
  "warehouses.write",
  "locations.quarantine",
  "products.read",
  "products.write",
  "category.read",
  "category.create",
  "category.update",
  "category.delete",
];

interface RoleFormModalProps {
  isOpen: boolean;
  role: Role | null;
  roles: Role[];
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
}

export function RoleFormModal({
  isOpen,
  role,
  roles,
  onClose,
  onSave,
}: RoleFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0066cc");
  const [parentId, setParentId] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setName(role?.name || "");
    setDescription(role?.description || "");
    setColor(role?.color || "#0066cc");
    setParentId(role?.parent_id || "");
    setPermissions(role?.permissions || {});
  }, [isOpen, role]);

  if (!isOpen) return null;

  const togglePermission = (key: string) => {
    setPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        name,
        description: description || null,
        color,
        parent_id: parentId || null,
        permissions,
        board_position: role?.board_position || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-[92%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
          <h2 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
            {role ? t.rbac.editRole : t.rbac.addRole}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <form
          id="roleForm"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-5"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
              {t.rbac.roleName}
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                {t.rbac.roleColor}
              </span>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-2"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                {t.rbac.parentRole}
              </span>
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
              >
                <option value="">{t.rbac.rootRole}</option>
                {roles
                  .filter((item) => item.id !== role?.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
              {t.warehouses.descriptionField}
            </span>
            <textarea
              value={description}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-4 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>

          <div>
            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
              {t.rbac.permissions}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={permissions[permission] === true}
                    onChange={() => togglePermission(permission)}
                    className="h-4 w-4 rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="roleForm"
            disabled={isSubmitting}
            className="h-10 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
