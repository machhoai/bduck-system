"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { X } from "lucide-react";
import { UserStatus } from "@bduck/shared-types";
import type { Role, Warehouse } from "@bduck/shared-types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import { EffectiveAccessPreview } from "./EffectiveAccessPreview";
import {
  createEmptyAssignment,
  UserAssignmentEditor,
  type AssignmentDraft,
} from "./UserAssignmentEditor";
import {
  dedupeAssignments,
  toAssignmentDraft,
  UserFormField as Field,
  userFormInputClassName as inputClassName,
} from "./userFormSupport";

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
  const title = isEdit ? t.users.editUser : t.users.addUser;

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    employee_id: "",
    workplace_facility_id: "",
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
        workplace_facility_id: user.workplace_facility_id || "",
        status: user.status,
      });
      setAssignments(
        user.assignments.filter((assignment) => assignment.is_active).length > 0
          ? user.assignments
              .filter((assignment) => assignment.is_active)
              .map(toAssignmentDraft)
          : [createEmptyAssignment(user.workplace_facility_id || "")],
      );
      return;
    }

    setFormData({
      username: "",
      email: "",
      password: "",
      full_name: "",
      employee_id: "",
      workplace_facility_id: warehouses[0]?.id || "",
      status: UserStatus.ACTIVE,
    });
    setAssignments([createEmptyAssignment(warehouses[0]?.id || "")]);
  }, [isOpen, user, warehouses]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...(isEdit && user?.username ? { username: formData.username } : {}),
        email: formData.email,
        full_name: formData.full_name,
        employee_id: formData.employee_id,
        workplace_facility_id: formData.workplace_facility_id,
        status: formData.status,
        ...(formData.password ? { password: formData.password } : {}),
        assignments: dedupeAssignments(assignments)
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

  const formFields = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isEdit && user?.username && (
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
        )}
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
        <Field label={t.officeScope.workplace}>
          <select
            required
            value={formData.workplace_facility_id}
            onChange={(event) =>
              setFormData({
                ...formData,
                workplace_facility_id: event.target.value,
              })
            }
            className={inputClassName}
          >
            <option value="" disabled>
              {t.officeScope.selectWorkplace}
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} · {t.warehouses.types[warehouse.type]}
              </option>
            ))}
          </select>
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

      <EffectiveAccessPreview
        key={formData.workplace_facility_id}
        userId={user?.id}
        facilities={warehouses}
        draft={{
          workplaceFacilityId: formData.workplace_facility_id,
          assignments,
          roles,
        }}
      />

      <details className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
          {t.officeScope.directAssignments}
        </summary>
        <p className="mb-4 mt-2 text-xs text-[var(--color-text-muted)]">
          {t.officeScope.directAssignmentsHint}
        </p>
        <UserAssignmentEditor
          assignments={assignments}
          roles={roles}
          warehouses={warehouses}
          defaultFacilityId={formData.workplace_facility_id}
          onChange={setAssignments}
        />
      </details>
    </>
  );

  return (
    <>
      {/* Desktop Modal Dialog (md and larger) */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] md:flex">
        <div className="flex max-h-[92vh] w-[90%] max-w-[760px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
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
            id="userFormDesktop"
            onSubmit={handleSubmit}
            className="flex-1 space-y-5 overflow-y-auto p-5"
          >
            {formFields}
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
              form="userFormDesktop"
              disabled={isSubmitting}
              className="h-8 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {t.common.save}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Native BottomSheet (< md) */}
      <BottomSheet
        title={title}
        isOpen={isOpen}
        onClose={onClose}
        defaultSnap="full"
        zIndex={50}
        contentClassName="flex flex-col overflow-y-auto overscroll-contain px-4 pb-6"
      >
        <form
          id="userFormMobile"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-2 pb-2"
        >
          {formFields}

          {/* Sticky Mobile Action Buttons at Bottom of Sheet */}
          <div className="sticky bottom-0 -mx-4 -mb-6 mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]/95 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-8 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-8 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? t.users.saving : t.common.save}
            </button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
