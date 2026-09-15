"use client";

import { ActiveStatus, WarehouseType } from "@bduck/shared-types";
import type { Organization } from "@bduck/shared-types";
import { Building2 } from "lucide-react";
import type React from "react";

import {
  WarehouseFormField,
  warehouseInputClassName,
} from "./WarehouseFormField";
import type { WarehouseFormValues } from "./types";
import type { Dictionary } from "@/lib/i18n";

interface WarehouseFormGeneralSectionProps {
  formData: WarehouseFormValues;
  setFormData: React.Dispatch<React.SetStateAction<WarehouseFormValues>>;
  organizations: Organization[];
  organizationsLoading: boolean;
  organizationsError: string | null;
  t: Dictionary;
}

export function WarehouseFormGeneralSection({
  formData,
  setFormData,
  organizations,
  organizationsLoading,
  organizationsError,
  t,
}: WarehouseFormGeneralSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <Building2 size={13} />
        </div>
        <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t.warehouses.tabWarehouses} · {t.warehouses.tabOrganizations}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WarehouseFormField label={t.warehouses.organizationId} required>
          <select
            required
            value={formData.organization_id}
            disabled={organizationsLoading || organizations.length === 0}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                organization_id: event.target.value,
              }))
            }
            className={warehouseInputClassName}
          >
            <option value="">
              {organizationsLoading
                ? t.common.loading
                : t.warehouses.selectOrganization}
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </select>
          {(organizationsError || organizations.length === 0) &&
            !organizationsLoading && (
              <p className="mt-1 text-xxs text-[var(--color-accent-error)]">
                {organizationsError || t.warehouses.noOrganizations}
              </p>
            )}
        </WarehouseFormField>

        <WarehouseFormField label={t.warehouses.code} required>
          <input
            required
            value={formData.code}
            placeholder="WH-001"
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, code: event.target.value }))
            }
            className={`${warehouseInputClassName} uppercase font-mono`}
          />
        </WarehouseFormField>

        <WarehouseFormField
          label={t.warehouses.name}
          required
          className="sm:col-span-2"
        >
          <input
            required
            value={formData.name}
            placeholder={t.warehouses.name}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, name: event.target.value }))
            }
            className={warehouseInputClassName}
          />
        </WarehouseFormField>

        <WarehouseFormField label={t.warehouses.type} required>
          <select
            value={formData.type}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                type: event.target.value as WarehouseType,
              }))
            }
            className={warehouseInputClassName}
          >
            {Object.values(WarehouseType).map((type) => (
              <option key={type} value={type}>
                {t.warehouses.types[type]}
              </option>
            ))}
          </select>
        </WarehouseFormField>

        <WarehouseFormField label={t.warehouses.status} required>
          <select
            value={formData.status}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                status: event.target.value as ActiveStatus,
              }))
            }
            className={warehouseInputClassName}
          >
            {Object.values(ActiveStatus).map((status) => (
              <option key={status} value={status}>
                {t.warehouses.statuses[status]}
              </option>
            ))}
          </select>
        </WarehouseFormField>
      </div>
    </div>
  );
}
