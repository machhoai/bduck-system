"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  IdCard,
  Plus,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { profileStatusLabel } from "./employeeProfileFormTypes";
import {
  EmployeeRow,
  EmployeeSkeleton,
  MetricCard,
} from "./EmployeeManagementParts";
import {
  filterWarehousesByScope,
  isWarehouseInScope,
  type PermissionScope,
} from "./employeeManagementScope";

interface EmployeeManagementViewProps {
  profiles: EmployeeProfile[];
  users: UserWithAssignments[];
  warehouses: Warehouse[];
  readScope: PermissionScope;
  writeScope: PermissionScope;
  isLoading: boolean;
  error: string | null;
  canCreate: boolean;
  onCreate: () => void;
  onEdit: (profile: EmployeeProfile) => void;
  onDelete: (profile: EmployeeProfile) => void;
}

export function EmployeeManagementView(props: EmployeeManagementViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const warehouseById = useMemo(
    () => new Map(props.warehouses.map((item) => [item.id, item])),
    [props.warehouses],
  );
  const userById = useMemo(
    () => new Map(props.users.map((item) => [item.id, item])),
    [props.users],
  );
  const readableWarehouses = useMemo(
    () => filterWarehousesByScope(props.warehouses, props.readScope),
    [props.readScope, props.warehouses],
  );
  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return props.profiles
      .filter((profile) =>
        isWarehouseInScope(profile.workplace_warehouse_id, props.readScope),
      )
      .filter(
        (profile) =>
          warehouseFilter === "ALL" ||
          profile.workplace_warehouse_id === warehouseFilter,
      )
      .filter(
        (profile) => statusFilter === "ALL" || profile.status === statusFilter,
      )
      .filter((profile) => {
        if (!term) return true;
        const user = profile.user_id ? userById.get(profile.user_id) : null;
        return [
          profile.employee_code,
          profile.full_name,
          profile.email,
          profile.phone,
          profile.job_title,
          profile.department,
          warehouseById.get(profile.workplace_warehouse_id)?.name,
          user?.username,
          user?.email,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [
    props.profiles,
    props.readScope,
    search,
    statusFilter,
    userById,
    warehouseById,
    warehouseFilter,
  ]);
  const stats = {
    total: visibleProfiles.length,
    active: visibleProfiles.filter(
      (item) => item.status === EmployeeProfileStatus.ACTIVE,
    ).length,
    linked: visibleProfiles.filter((item) => item.user_id).length,
  };

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
            <IdCard size={14} />
            Hồ sơ nhân viên
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Quản lý nhân viên
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Quản lý hồ sơ nhân sự, nơi làm việc chính theo cơ sở và tài khoản
              đăng nhập.
            </p>
          </div>
        </div>
        {props.canCreate && (
          <button
            type="button"
            onClick={props.onCreate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Tạo hồ sơ
          </button>
        )}
      </header>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={IdCard} label="Hồ sơ hiển thị" value={stats.total} />
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
              placeholder="Tìm tên, mã nhân viên, email, cơ sở..."
              className="h-9 w-full rounded-full border border-[var(--color-border-subtle)] pl-10 pr-4 text-sm"
            />
          </label>
          <select
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value)}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm"
          >
            <option value="ALL">Tất cả cơ sở</option>
            {readableWarehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.values(EmployeeProfileStatus).map((status) => (
              <option key={status} value={status}>
                {profileStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        {props.error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-error)] p-3 text-sm text-[var(--color-accent-error)]">
            {props.error}
          </div>
        )}
        {props.isLoading ? (
          <EmployeeSkeleton />
        ) : visibleProfiles.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] p-4 text-center">
            <div>
              <IdCard
                size={38}
                className="mx-auto text-[var(--color-text-muted)]"
              />
              <h2 className="mt-2 text-sm font-semibold">
                Chưa có hồ sơ nhân viên phù hợp
              </h2>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            <table className="w-full min-w-[1080px] bg-white text-left text-sm">
              <thead className="bg-[var(--color-surface-card)] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  {[
                    "Nhân viên",
                    "Liên hệ",
                    "Nơi làm việc",
                    "Tài khoản",
                    "Trạng thái",
                    "Thao tác",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleProfiles.map((profile) => (
                  <EmployeeRow
                    key={profile.id}
                    profile={profile}
                    user={
                      profile.user_id ? userById.get(profile.user_id) : null
                    }
                    warehouse={warehouseById.get(
                      profile.workplace_warehouse_id,
                    )}
                    canWrite={isWarehouseInScope(
                      profile.workplace_warehouse_id,
                      props.writeScope,
                    )}
                    onEdit={props.onEdit}
                    onDelete={props.onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
