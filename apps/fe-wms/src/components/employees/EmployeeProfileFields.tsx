"use client";

import type { Dispatch, SetStateAction } from "react";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import {
  profileStatusLabel,
  type EmployeeProfileFormState,
} from "./employeeProfileFormTypes";

interface EmployeeProfileFieldsProps {
  value: EmployeeProfileFormState;
  users: UserWithAssignments[];
  warehouses: Warehouse[];
  disableUserLink: boolean;
  onChange: Dispatch<SetStateAction<EmployeeProfileFormState>>;
}

const inputClassName =
  "h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none transition-colors focus:border-[var(--color-border-focus)]";

export function EmployeeProfileFields({
  value,
  users,
  warehouses,
  disableUserLink,
  onChange,
}: EmployeeProfileFieldsProps) {
  const { t } = useTranslation();
  const set = (field: keyof EmployeeProfileFormState, next: string) =>
    onChange((current) => ({ ...current, [field]: next }));
  return (
    <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Mã nhân viên">
          <input
            required
            value={value.employee_code}
            onChange={(event) => set("employee_code", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="Họ và tên">
          <input
            required
            value={value.full_name}
            onChange={(event) => set("full_name", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={value.email}
            onChange={(event) => set("email", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="Số điện thoại">
          <input
            value={value.phone}
            onChange={(event) => set("phone", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="Chức danh">
          <input
            value={value.job_title}
            onChange={(event) => set("job_title", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="Bộ phận">
          <input
            value={value.department}
            onChange={(event) => set("department", event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label={t.officeScope.workplace}>
          <select
            required
            value={value.workplace_warehouse_id}
            onChange={(event) =>
              set("workplace_warehouse_id", event.target.value)
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
        <Field label="Trạng thái">
          <select
            value={value.status}
            onChange={(event) => set("status", event.target.value)}
            className={inputClassName}
          >
            {Object.values(EmployeeProfileStatus).map((status) => (
              <option key={status} value={status}>
                {profileStatusLabel(status)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <Field label="Ghi chú">
          <textarea
            value={value.notes}
            onChange={(event) => set("notes", event.target.value)}
            className="min-h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
          />
        </Field>
        <Field label="Liên kết tài khoản có sẵn">
          <select
            value={value.user_id}
            disabled={disableUserLink}
            onChange={(event) => set("user_id", event.target.value)}
            className={inputClassName}
          >
            <option value="">Chưa liên kết</option>
            {users
              .filter((user) => !user.is_deleted)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} - {user.email}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </section>
  );
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
