"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { X } from "lucide-react";
import { UserStatus } from "@bduck/shared-types";
import type { Role, UserWarehouseRole, Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import {
  createEmptyAssignment,
  UserAssignmentEditor,
  type AssignmentDraft,
} from "./UserAssignmentEditor";

interface UserFormModalProps {
  isOpen: boolean;
  user: UserWithAssignments | null;
  roles: Role[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
}

export function UserFormModal({
  isOpen,
  user,
  roles,
  warehouses,
  onClose,
  onSave,
}: UserFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(user);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    employee_id: "",
    status: UserStatus.ACTIVE,
  });
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([
    createEmptyAssignment(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: "",
        full_name: user.full_name,
        employee_id: user.employee_id,
        status: user.status,
      });
      setAssignments(
        user.assignments.length > 0
          ? user.assignments.map(toAssignmentDraft)
          : [createEmptyAssignment()],
      );
      return;
    }

    setFormData({
      username: "",
      email: "",
      password: "",
      full_name: "",
      employee_id: "",
      status: UserStatus.ACTIVE,
    });
    setAssignments([createEmptyAssignment()]);
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        employee_id: formData.employee_id,
        status: formData.status,
        ...(formData.password ? { password: formData.password } : {}),
        assignments: assignments
          .filter((assignment) => assignment.role_id)
          .map((assignment) => ({
            warehouse_id: assignment.warehouse_id || null,
            role_id: assignment.role_id,
            valid_from: assignment.valid_from,
            valid_until: assignment.valid_until || null,
            is_active: assignment.is_active,
          })),
      };

      await onSave(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-[94%] max-w-[90%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEdit ? t.users.editUser : t.users.addUser}
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
          id="userForm"
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto p-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t.users.username}>
              <input
                required
                value={formData.username}
                onChange={(event) =>
                  setFormData({ ...formData, username: event.target.value })
                }
                className={inputClassName}
              />
            </Field>
            <Field label={t.users.email}>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData({ ...formData, email: event.target.value })
                }
                className={inputClassName}
              />
            </Field>
            <Field label={t.users.fullName}>
              <input
                required
                value={formData.full_name}
                onChange={(event) =>
                  setFormData({ ...formData, full_name: event.target.value })
                }
                className={inputClassName}
              />
            </Field>
            <Field label={t.users.employeeId}>
              <input
                required
                value={formData.employee_id}
                onChange={(event) =>
                  setFormData({ ...formData, employee_id: event.target.value })
                }
                className={inputClassName}
              />
            </Field>
            {isEdit && (
              <Field label={t.users.password}>
                <input
                  type="password"
                  minLength={8}
                  value={formData.password}
                  placeholder={t.users.passwordPlaceholder}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>
            )}
            <Field label={t.users.status}>
              <select
                value={formData.status}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    status: event.target.value as UserStatus,
                  })
                }
                className={inputClassName}
              >
                {Object.values(UserStatus).map((status) => (
                  <option key={status} value={status}>
                    {t.users.statuses[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <UserAssignmentEditor
            assignments={assignments}
            roles={roles}
            warehouses={warehouses}
            onChange={setAssignments}
          />
        </form>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="userForm"
            disabled={isSubmitting}
            className="h-8 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClassName =
  "h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]";

function toAssignmentDraft(assignment: UserWarehouseRole): AssignmentDraft {
  return {
    warehouse_id: assignment.warehouse_id || "",
    role_id: assignment.role_id,
    valid_from: assignment.valid_from,
    valid_until: assignment.valid_until || "",
    is_active: assignment.is_active,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
