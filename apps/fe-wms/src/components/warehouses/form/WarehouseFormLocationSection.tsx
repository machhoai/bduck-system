"use client";

import type { User } from "@bduck/shared-types";
import { Compass, MapPin, UserCheck } from "lucide-react";
import type React from "react";

import {
  WarehouseFormField,
  warehouseInputClassName,
} from "./WarehouseFormField";
import type { WarehouseFormValues } from "./types";
import { WarehouseManagerSelect } from "../WarehouseManagerSelect";
import type { Dictionary } from "@/lib/i18n";

interface WarehouseFormLocationSectionProps {
  formData: WarehouseFormValues;
  setFormData: React.Dispatch<React.SetStateAction<WarehouseFormValues>>;
  managerOptions: User[];
  usersLoading: boolean;
  usersError: string | null;
  t: Dictionary;
}

export function WarehouseFormLocationSection({
  formData,
  setFormData,
  managerOptions,
  usersLoading,
  usersError,
  t,
}: WarehouseFormLocationSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <MapPin size={13} />
        </div>
        <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t.warehouses.managerId} & {t.warehouses.address}
        </span>
      </div>

      <div className="space-y-3">
        <WarehouseFormField
          label={t.warehouses.managerId}
          hint={t.warehouses.managerIdHint}
        >
          <WarehouseManagerSelect
            users={managerOptions}
            value={formData.manager_id}
            loading={usersLoading}
            error={usersError}
            disabled={usersLoading}
            onChange={(managerId) =>
              setFormData((prev) => ({ ...prev, manager_id: managerId }))
            }
          />
        </WarehouseFormField>

        <WarehouseFormField label={t.warehouses.address}>
          <div className="relative">
            <input
              value={formData.address}
              placeholder="123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh"
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              className={warehouseInputClassName}
            />
          </div>
        </WarehouseFormField>

        {/* Tọa độ địa lý (Coordinates) */}
        <div className="rounded-lg border border-[var(--color-border-soft)] bg-white/80 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              <Compass size={13} className="text-[var(--color-brand-primary)]" />
              <span>{t.warehouses.viewMap} (GPS)</span>
            </div>
            <span className="text-xxs text-[var(--color-text-muted)]">
              WGS84 Format
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <WarehouseFormField label={t.warehouses.longitude}>
              <input
                type="number"
                step="any"
                placeholder="106.660172"
                value={formData.longitude}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    longitude: event.target.value,
                  }))
                }
                className={warehouseInputClassName}
              />
            </WarehouseFormField>

            <WarehouseFormField label={t.warehouses.latitude}>
              <input
                type="number"
                step="any"
                placeholder="10.762622"
                value={formData.latitude}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    latitude: event.target.value,
                  }))
                }
                className={warehouseInputClassName}
              />
            </WarehouseFormField>
          </div>
        </div>
      </div>
    </div>
  );
}
