import { Filter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { AuditAction } from "@bduck/shared-types";
import type { AuditLogFilters } from "@/utils/auditLogFilters";
import { defaultAuditLogFilters } from "@/utils/auditLogFilters";

interface AuditLogFiltersPanelProps {
  filters: AuditLogFilters;
  entityTypes: string[];
  actions: AuditAction[];
  labels: {
    search: string;
    entityType: string;
    entityId: string;
    userId: string;
    action: string;
    fromDate: string;
    toDate: string;
    valueState: string;
    sortBy: string;
    sortDirection: string;
    clear: string;
    all: string;
    hasOld: string;
    hasNew: string;
    hasBoth: string;
    hasIp: string;
    hasDevice: string;
    hasSession: string;
    hasNotes: string;
    asc: string;
    desc: string;
  };
  onChange: (filters: AuditLogFilters) => void;
}

export function AuditLogFiltersPanel({
  filters,
  entityTypes,
  actions,
  labels,
  onChange,
}: AuditLogFiltersPanelProps) {
  const update = <K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[17px] font-semibold text-[var(--color-text-primary)]">
          <Filter size={18} />
          {labels.search}
        </div>
        <button
          type="button"
          onClick={() => onChange(defaultAuditLogFilters)}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 text-sm text-[var(--color-text-secondary)] transition-all active:scale-95"
        >
          <X size={15} />
          {labels.clear}
        </button>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder={labels.search}
          className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white pl-11 pr-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label={labels.entityType}
          value={filters.entityType}
          onChange={(value) => update("entityType", value)}
        >
          <option value="all">{labels.all}</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={labels.action}
          value={filters.action}
          onChange={(value) => update("action", value)}
        >
          <option value="all">{labels.all}</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </SelectField>

        <InputField
          label={labels.entityId}
          value={filters.entityId}
          onChange={(value) => update("entityId", value)}
        />
        <InputField
          label={labels.userId}
          value={filters.userId}
          onChange={(value) => update("userId", value)}
        />
        <InputField
          type="date"
          label={labels.fromDate}
          value={filters.fromDate}
          onChange={(value) => update("fromDate", value)}
        />
        <InputField
          type="date"
          label={labels.toDate}
          value={filters.toDate}
          onChange={(value) => update("toDate", value)}
        />

        <SelectField
          label={labels.valueState}
          value={filters.valueState}
          onChange={(value) =>
            update("valueState", value as AuditLogFilters["valueState"])
          }
        >
          <option value="all">{labels.all}</option>
          <option value="has_old">{labels.hasOld}</option>
          <option value="has_new">{labels.hasNew}</option>
          <option value="has_both">{labels.hasBoth}</option>
        </SelectField>

        <SelectField
          label={labels.sortBy}
          value={filters.sortField}
          onChange={(value) =>
            update("sortField", value as AuditLogFilters["sortField"])
          }
        >
          <option value="sync_time">sync_time</option>
          <option value="action_time">action_time</option>
          <option value="action">action</option>
          <option value="entity_type">entity_type</option>
          <option value="user_id">user_id</option>
        </SelectField>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["hasIp", labels.hasIp],
          ["hasDevice", labels.hasDevice],
          ["hasSession", labels.hasSession],
          ["hasNotes", labels.hasNotes],
        ].map(([key, label]) => (
          <ToggleChip
            key={key}
            label={label}
            active={Boolean(filters[key as keyof AuditLogFilters])}
            onClick={() =>
              update(
                key as keyof AuditLogFilters,
                !filters[key as keyof AuditLogFilters] as never,
              )
            }
          />
        ))}
        <ToggleChip
          label={labels.asc}
          active={filters.sortDirection === "asc"}
          onClick={() => update("sortDirection", "asc")}
        />
        <ToggleChip
          label={labels.desc}
          active={filters.sortDirection === "desc"}
          onClick={() => update("sortDirection", "desc")}
        />
      </div>
    </section>
  );
}

function InputField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-full border border-[var(--color-border-subtle)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
      >
        {children}
      </select>
    </label>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full border px-3 text-sm transition-all active:scale-95 ${
        active
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
          : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
      }`}
    >
      {label}
    </button>
  );
}
