import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
} from "lucide-react";
import type { ExternalCountSession } from "@/api/externalCountApi";
import type { ExternalCountPageText } from "./externalCountPageCopy";
import {
  externalCountStatusClass,
  formatExternalCountBusinessDate,
  formatExternalCountDateTime,
  getExternalCountExecutionTime,
} from "./externalCountFormatters";

type FacilityLabel = {
  name?: string | null;
  code?: string | null;
};

export default function ExternalCountSessionList({
  sessions,
  isLoading,
  warehouseById,
  locationById,
  lang,
  text,
  onSelect,
}: {
  sessions: ExternalCountSession[];
  isLoading: boolean;
  warehouseById: ReadonlyMap<string, FacilityLabel>;
  locationById: ReadonlyMap<string, FacilityLabel>;
  lang: "vi" | "zh";
  text: ExternalCountPageText;
  onSelect: (sessionId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 p-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 text-center">
        <ClipboardList className="h-10 w-10 text-[var(--color-neutral-300)]" />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {text.emptyTitle}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          {text.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-3">
      {sessions.map((session) => {
        const warehouse = warehouseById.get(session.warehouse_id);
        const location = session.warehouse_location_id
          ? locationById.get(session.warehouse_location_id)
          : null;
        const checkpointLabel =
          session.checkpoint_type === "SHIFT_OPENING" ||
          session.checkpoint_type === "BEFORE_SCAN"
            ? text.openingLabel
            : session.checkpoint_type === "OPTIONAL_CLOSING"
              ? text.optionalClosingLabel
              : session.checkpoint_type === "BEFORE_SUBMIT"
                ? text.beforeSubmitLabel
                : session.checkpoint_type || "-";
        const performedAt = formatExternalCountDateTime(
          getExternalCountExecutionTime(session),
          lang,
        );
        const statusLabel =
          text.statuses[session.status as keyof typeof text.statuses] ??
          session.status;

        return (
          <button
            key={session.id}
            type="button"
            aria-label={`${text.viewDetails}: ${session.session_number}`}
            onClick={() => onSelect(session.id)}
            className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-white p-4 text-left transition hover:border-[var(--color-border-focus)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${externalCountStatusClass(session.status)}`}
                  >
                    {statusLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {checkpointLabel}
                  </span>
                  {session.status === "DISCREPANCY_FOUND" && (
                    <AlertTriangle className="h-4 w-4 text-[var(--color-warning-text)]" />
                  )}
                  <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                    {location?.name ||
                      location?.code ||
                      session.warehouse_location_id}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-4">
                  <span className="truncate">
                    {warehouse?.name || warehouse?.code || session.warehouse_id}
                  </span>
                  <span className="truncate">
                    {text.operator}:{" "}
                    {session.external_operator_name ||
                      session.external_operator_id ||
                      "-"}
                  </span>
                  <span className="truncate">
                    {text.client}: {session.external_client_id || "-"}
                  </span>
                  <span>
                    {text.discrepancy}: {session.discrepancy_count ?? 0}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-[var(--color-text-muted)]">
                  {session.session_number} · {text.idempotency}:{" "}
                  {session.idempotency_key || "-"}
                </p>
              </div>
              <div className="flex min-w-[190px] items-center gap-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {text.performedAt}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-[var(--color-brand-primary)]" />
                      {performedAt.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Clock3 className="h-4 w-4 text-[var(--color-brand-primary)]" />
                      {performedAt.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                    {text.businessDate}:{" "}
                    {formatExternalCountBusinessDate(
                      session.business_date,
                      lang,
                    )}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
