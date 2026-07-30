"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  IdCard,
  Plus,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { EmployeeProfileStatus } from "@bduck/shared-types";
import type { EmployeeProfile, Warehouse } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useEmployeeContractLabels } from "@/hooks/useEmployeeContractLabels";
import { useExpiringEmployeeContracts } from "@/hooks/useExpiringEmployeeContracts";
import { useTranslation } from "@/lib/i18n";
import { isEmployeeContractsFeatureEnabled } from "@/lib/employeeContractFeatureFlag";
import { profileStatusLabel } from "./employeeProfileFormTypes";
import {
  EmployeeRow,
  EmployeeRowCard,
  EmployeeSkeleton,
  MetricCard,
} from "./EmployeeManagementParts";
import { EmployeeDetailBottomSheet } from "./EmployeeDetailBottomSheet";
import { EmployeeContractExpiryPanel } from "./EmployeeContractExpiryPanel";
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
  canManageEmployment: (profile: EmployeeProfile) => boolean;
  onManageEmployment: (profile: EmployeeProfile) => void;
}

export function EmployeeManagementView(props: EmployeeManagementViewProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement;
  const contractLabels = useEmployeeContractLabels();
  const statusLabels = t.employeeManagement.statusLabels as Record<
    string,
    string
  >;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [selectedDetailProfile, setSelectedDetailProfile] =
    useState<EmployeeProfile | null>(null);
  const [isExpiryModalOpen, setIsExpiryModalOpen] = useState(false);

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
  const profileSummaryById = useMemo(
    () =>
      new Map(
        props.profiles.map((profile) => [
          profile.id,
          {
            full_name: profile.full_name,
            employee_code: profile.employee_code,
          },
        ]),
      ),
    [props.profiles],
  );
  const expiring = useExpiringEmployeeContracts(
    contractLabels.expiry.loadError,
    isEmployeeContractsFeatureEnabled,
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
    <div className="flex w-full flex-col gap-3">
      {/* Header section */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <IdCard size={20} />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-[var(--color-text-primary)]">
              {labels.title}
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {labels.subtitle}
            </p>
          </div>
        </div>

        {props.canCreate && (
          <button
            type="button"
            onClick={props.onCreate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 cursor-pointer w-fit sm:w-auto"
          >
            <Plus size={16} />
            <span>{labels.createProfile}</span>
          </button>
        )}
      </header>

      {/* Metric cards */}
      <section
        className={`grid gap-2.5 ${
          isEmployeeContractsFeatureEnabled
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-3"
        }`}
      >
        <MetricCard
          icon={IdCard}
          label={labels.metrics.total}
          value={stats.total}
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label={labels.metrics.active}
          value={stats.active}
        />
        <MetricCard
          icon={UserRoundCheck}
          label={labels.metrics.linked}
          value={stats.linked}
        />
        {isEmployeeContractsFeatureEnabled && (
          <MetricCard
            icon={CalendarClock}
            label={contractLabels.expiry.title}
            value={expiring.contracts.length}
            onClick={() => setIsExpiryModalOpen(true)}
            iconBg={
              expiring.contracts.length > 0
                ? "bg-amber-100"
                : undefined
            }
            iconColor={
              expiring.contracts.length > 0
                ? "text-amber-700"
                : undefined
            }
            className={
              expiring.contracts.length > 0
                ? "border-amber-300/80 bg-amber-50/40 hover:border-amber-400"
                : undefined
            }
          />
        )}
      </section>

      {/* Main content panel & filters */}
      <section className="flex flex-col gap-3 lg:shadow-none">
        <div className="grid gap-2 rounded-2xl border border-white/80 bg-white p-3 shadow-xs lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-subtle)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="relative block">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.filters.searchPlaceholder}
              className="h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] pl-9 pr-3 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:bg-white"
            />
          </label>
          <div className="flex gap-2 w-full">
            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              className="h-9 flex-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:bg-white cursor-pointer"
            >
              <option value="ALL">{labels.filters.allWarehouses}</option>
              {readableWarehouses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-full flex-1 border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:bg-white cursor-pointer"
            >
              <option value="ALL">{labels.filters.allStatuses}</option>
              {Object.values(EmployeeProfileStatus).map((status) => (
                <option key={status} value={status}>
                  {profileStatusLabel(status, statusLabels)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {props.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-[#b42318]">
            {props.error}
          </div>
        )}

        {props.isLoading ? (
          <EmployeeSkeleton />
        ) : visibleProfiles.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[#f8fafc] p-6 text-center">
            <div>
              <IdCard
                size={36}
                className="mx-auto text-[var(--color-text-muted)]"
              />
              <h2 className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {labels.emptyState.title}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {labels.emptyState.hint}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Native App Cards View (Displays on mobile & small viewports) */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:hidden">
              {visibleProfiles.map((profile) => (
                <EmployeeRowCard
                  key={profile.id}
                  profile={profile}
                  user={profile.user_id ? userById.get(profile.user_id) : null}
                  warehouse={warehouseById.get(profile.workplace_warehouse_id)}
                  canWrite={isWarehouseInScope(
                    profile.workplace_warehouse_id,
                    props.writeScope,
                  )}
                  onViewDetails={setSelectedDetailProfile}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                />
              ))}
            </div>

            {/* High-Density Table View (Displays on Desktop viewports) */}
            <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] lg:block">
              <table className="w-full min-w-[960px] bg-white text-left text-sm">
                <thead className="bg-[var(--color-surface-card)] text-xxs md:text-xs font-semibold tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)]">
                  <tr>
                    {[
                      labels.tableHeaders.employee,
                      labels.tableHeaders.jobTitleDept,
                      labels.tableHeaders.contact,
                      labels.tableHeaders.workplace,
                      labels.tableHeaders.account,
                      labels.tableHeaders.status,
                      labels.tableHeaders.actions,
                    ].map((label) => (
                      <th key={label} className="px-4 py-2.5">
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
                      onViewDetails={setSelectedDetailProfile}
                      onEdit={props.onEdit}
                      onDelete={props.onDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* BottomSheet Employee Detail Modal */}
      <EmployeeDetailBottomSheet
        isOpen={Boolean(selectedDetailProfile)}
        profile={selectedDetailProfile}
        user={
          selectedDetailProfile?.user_id
            ? userById.get(selectedDetailProfile.user_id)
            : null
        }
        warehouse={
          selectedDetailProfile
            ? warehouseById.get(selectedDetailProfile.workplace_warehouse_id)
            : null
        }
        canWrite={
          selectedDetailProfile
            ? isWarehouseInScope(
                selectedDetailProfile.workplace_warehouse_id,
                props.writeScope,
              )
            : false
        }
        canManageEmployment={
          selectedDetailProfile
            ? props.canManageEmployment(selectedDetailProfile)
            : false
        }
        onClose={() => setSelectedDetailProfile(null)}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onManageEmployment={props.onManageEmployment}
      />

      {/* Contract Expiry Modal */}
      {isEmployeeContractsFeatureEnabled && (
        <EmployeeContractExpiryPanel
          isOpen={isExpiryModalOpen}
          onClose={() => setIsExpiryModalOpen(false)}
          contracts={expiring.contracts}
          profiles={profileSummaryById}
          labels={contractLabels}
          isLoading={expiring.isLoading}
          error={expiring.error}
          onOpenEmployee={(profileId) =>
            setSelectedDetailProfile(
              props.profiles.find((profile) => profile.id === profileId) ??
                null,
            )
          }
        />
      )}
    </div>
  );
}
