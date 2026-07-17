"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type React from "react";
import type { Role, Warehouse } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";

export type AssignmentDraft = {
  client_id: string;
  warehouse_id: string;
  role_id: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

interface UserAssignmentEditorProps {
  assignments: AssignmentDraft[];
  roles: Role[];
  warehouses: Warehouse[];
  defaultFacilityId?: string;
  onChange: (assignments: AssignmentDraft[]) => void;
}

export const createEmptyAssignment = (facilityId = ""): AssignmentDraft => ({
  client_id:
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  warehouse_id: facilityId,
  role_id: "",
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: "",
  is_active: true,
});

export function UserAssignmentEditor({
  assignments,
  roles,
  warehouses,
  defaultFacilityId,
  onChange,
}: UserAssignmentEditorProps) {
  const { t } = useTranslation();
  const isSystemAdmin = useUserStore(
    (state) => state.permissions.global?.["*"] === true,
  );
  const activeRoles = useMemo(
    () => roles.filter((role) => !role.is_deleted),
    [roles],
  );

  const updateAssignment = (
    index: number,
    key: keyof AssignmentDraft,
    value: string | boolean,
  ) => {
    onChange(
      assignments.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.users.roleAssignments}
        </h3>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...assignments,
              createEmptyAssignment(defaultFacilityId || warehouses[0]?.id),
            ])
          }
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95"
        >
          <Plus size={15} />
          {t.users.addAssignment}
        </button>
      </div>

      <div className="space-y-3">
        {assignments.map((assignment, index) => (
          <div
            key={assignment.client_id}
            className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-3 md:grid-cols-[1fr_1fr_140px_140px_90px_40px]"
          >
            <SelectField
              label={t.users.warehouseScope}
              value={assignment.warehouse_id}
              required={!isSystemAdmin}
              onChange={(value) =>
                updateAssignment(index, "warehouse_id", value)
              }
            >
              {isSystemAdmin ? (
                <option value="">{t.users.globalScope}</option>
              ) : (
                <option value="" disabled>
                  {t.officeScope.selectWorkplace}
                </option>
              )}
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t.users.role}
              value={assignment.role_id}
              onChange={(value) => updateAssignment(index, "role_id", value)}
            >
              <option value="">{t.users.selectRole}</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
            <DateField
              label={t.users.validFrom}
              value={assignment.valid_from}
              required
              onChange={(value) => updateAssignment(index, "valid_from", value)}
            />
            <DateField
              label={t.users.validUntil}
              value={assignment.valid_until}
              onChange={(value) =>
                updateAssignment(index, "valid_until", value)
              }
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={assignment.is_active}
                onChange={(event) =>
                  updateAssignment(index, "is_active", event.target.checked)
                }
                className="h-4 w-4"
              />
              {t.users.activeAssignment}
            </label>
            <button
              type="button"
              onClick={() =>
                onChange(
                  assignments.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="mb-1 mt-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-accent-error)] transition-all active:scale-95"
              aria-label={t.common.delete}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const inputClassName =
  "h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]";

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

function SelectField({
  label,
  value,
  required,
  onChange,
  children,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        {children}
      </select>
    </Field>
  );
}

function DateField({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        required={required}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </Field>
  );
}
