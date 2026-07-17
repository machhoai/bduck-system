"use client";

import { History, Minus, Plus, UsersRound } from "lucide-react";
import type {
  OfficeScopeHistoryEntry,
  OfficeScopeMode,
  Warehouse,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOfficeScopeHistory } from "@/hooks/useOfficeScopeHistory";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { formatAuditDate } from "@/utils/auditLogFilters";
import { OfficeScopeMaterializationBadge } from "./OfficeScopeMaterializationBadge";

interface OfficeScopeHistoryProps {
  officeId: string;
  facilities: Warehouse[];
}

export function OfficeScopeHistory({
  officeId,
  facilities,
}: OfficeScopeHistoryProps) {
  const { t } = useTranslation();
  const { entries, isLoading, hasError, retryMaterialization } =
    useOfficeScopeHistory(officeId);
  const canRetry = useUserStore((state) =>
    state.hasPermission("office_scopes.write", officeId),
  );
  const facilityNames = new Map(
    facilities.map((facility) => [facility.id, facility.name]),
  );

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-pearl)] text-[var(--color-brand-primary)]">
          <History size={19} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t.officeScope.historyTitle}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.officeScope.historyDescription}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <HistorySkeleton />
        ) : hasError ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
            {t.officeScope.historyLoadError}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 text-center text-sm text-[var(--color-text-muted)]">
            {t.officeScope.noHistory}
          </div>
        ) : (
          <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-[var(--color-border-subtle)]">
            {entries.map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                facilityNames={facilityNames}
                canRetry={canRetry}
                onRetry={() => retryMaterialization(entry.revision)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryEntry({
  entry,
  facilityNames,
  canRetry,
  onRetry,
}: {
  entry: OfficeScopeHistoryEntry;
  facilityNames: Map<string, string>;
  canRetry: boolean;
  onRetry: () => Promise<unknown>;
}) {
  const { t, lang } = useTranslation();
  const dateLocale = lang === "zh" ? "zh-CN" : "vi-VN";
  const mode = (value: OfficeScopeMode | null) =>
    value ? t.officeScope.modes[value] : t.officeScope.modes.UNCONFIGURED;
  return (
    <article className="relative grid grid-cols-[40px_1fr] gap-3">
      <span className="z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-xs font-bold text-[var(--color-brand-primary)]">
        {entry.revision}
      </span>
      <div className="min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {entry.actor_name || entry.actor_id || t.officeScope.unknownActor}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {mode(entry.previous_mode)} → {mode(entry.next_mode)}
            </p>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] sm:text-right">
            <p>
              {t.officeScope.actionTime}:{" "}
              {formatAuditDate(entry.action_time, "-", dateLocale)}
            </p>
            <p className="mt-1">
              {t.officeScope.syncTime}:{" "}
              {formatAuditDate(entry.sync_time, "-", dateLocale)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ScopeValueSnapshot
            label={t.officeScope.historyBeforeValue}
            mode={entry.previous_mode}
            ids={entry.previous_selected_facility_ids}
            facilityNames={facilityNames}
          />
          <ScopeValueSnapshot
            label={t.officeScope.historyAfterValue}
            mode={entry.next_mode}
            ids={entry.next_selected_facility_ids}
            facilityNames={facilityNames}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FacilityChanges
            icon={Plus}
            label={t.officeScope.historyAddedSelection}
            ids={entry.added_facility_ids}
            facilityNames={facilityNames}
            emptyLabel={t.officeScope.historyNoAddedSelection}
            tone="success"
          />
          <FacilityChanges
            icon={Minus}
            label={t.officeScope.historyRemovedSelection}
            ids={entry.removed_facility_ids}
            facilityNames={facilityNames}
            emptyLabel={t.officeScope.historyNoRemovedSelection}
            tone="danger"
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <UsersRound size={14} />
          {t.officeScope.affectedAtChange}:{" "}
          {entry.affected_employee_count ?? t.officeScope.notRecorded}
        </p>
        {entry.next_mode === "ALL" && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {t.officeScope.historyAllDynamicHint}
          </p>
        )}
        <OfficeScopeMaterializationBadge
          materialization={entry.materialization}
          canRetry={canRetry}
          onRetry={onRetry}
        />
      </div>
    </article>
  );
}

function ScopeValueSnapshot({
  label,
  mode,
  ids,
  facilityNames,
}: {
  label: string;
  mode: OfficeScopeMode | null;
  ids: string[];
  facilityNames: Map<string, string>;
}) {
  const { t } = useTranslation();
  const modeLabel = mode
    ? t.officeScope.modes[mode]
    : t.officeScope.modes.UNCONFIGURED;
  const facilityLabel =
    mode === "ALL"
      ? t.officeScope.historyAllDynamicHint
      : ids.length > 0
        ? ids.map((id) => facilityNames.get(id) || id).join(", ")
        : t.officeScope.historyNoSelectedFacilities;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}: {modeLabel}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-muted)]">
        {facilityLabel}
      </p>
    </div>
  );
}

function FacilityChanges({
  icon: Icon,
  label,
  ids,
  facilityNames,
  emptyLabel,
  tone,
}: {
  icon: typeof Plus;
  label: string;
  ids: string[];
  facilityNames: Map<string, string>;
  emptyLabel: string;
  tone: "success" | "danger";
}) {
  const color = tone === "success" ? "text-emerald-700" : "text-rose-700";
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3">
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
        <Icon size={14} /> {label}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">
        {ids.length > 0
          ? ids.map((id) => facilityNames.get(id) || id).join(", ")
          : emptyLabel}
      </p>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[40px_1fr] gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-32 rounded-[var(--radius-md)]" />
        </div>
      ))}
    </div>
  );
}
