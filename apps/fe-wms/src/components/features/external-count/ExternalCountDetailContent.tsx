"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  Hash,
  MapPin,
  MonitorSmartphone,
  Package,
  UserRound,
  Warehouse,
} from "lucide-react";
import type { ExternalCountDetail } from "@/api/externalCountApi";
import ExternalCountItemCard from "./ExternalCountItemCard";
import type { ExternalCountDetailText } from "./externalCountDetailCopy";
import {
  externalCountStatusClass,
  formatExternalCountBusinessDate,
  formatExternalCountDateTime,
  getExternalCountExecutionTime,
} from "./externalCountFormatters";

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] p-3">
      <span className="mt-0.5 text-[var(--color-brand-primary)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-semibold text-[var(--color-text-primary)]">
          {value || "-"}
        </p>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === "warning"
            ? "text-[var(--color-warning-text)]"
            : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ExternalCountDetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 p-4">
      <div className="h-20 rounded-lg bg-[var(--color-neutral-100)]" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-16 rounded-lg bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-56 rounded-lg bg-[var(--color-neutral-100)]"
        />
      ))}
    </div>
  );
}

export default function ExternalCountDetailContent({
  detail,
  lang,
  text,
  onOpenImages,
}: {
  detail: ExternalCountDetail;
  lang: "vi" | "zh";
  text: ExternalCountDetailText;
  onOpenImages: (images: string[], index: number) => void;
}) {
  const { session, items } = detail;
  const performedAt = formatExternalCountDateTime(
    getExternalCountExecutionTime(session),
    lang,
  );
  const issueCount = items.filter(
    (item) =>
      item.has_discrepancy ||
      item.discrepancy !== 0 ||
      item.condition !== "GOOD",
  ).length;
  const evidenceCount = items.reduce(
    (total, item) => total + (item.evidence_urls?.length ?? 0),
    0,
  );
  const checkpointLabel =
    session.checkpoint_type === "BEFORE_SCAN"
      ? text.beforeScan
      : session.checkpoint_type === "BEFORE_SUBMIT"
        ? text.beforeSubmit
        : session.checkpoint_type || "-";
  const statusLabel =
    text.statuses[session.status as keyof typeof text.statuses] ??
    session.status;

  return (
    <div className="grid gap-4 p-4">
      <section className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${externalCountStatusClass(session.status)}`}
          >
            {statusLabel}
          </span>
          <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
            {checkpointLabel}
          </span>
        </div>
        <p className="mt-2 break-all text-base font-bold text-[var(--color-text-primary)]">
          {session.session_number}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {session.notes || text.noNotes}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {text.countResults}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <SummaryMetric label={text.productLines} value={items.length} />
          <SummaryMetric label={text.issueLines} value={issueCount} tone="warning" />
          <SummaryMetric label={text.evidenceImages} value={evidenceCount} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {text.sessionInfo}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoTile
            icon={<Warehouse className="h-4 w-4" />}
            label={text.warehouse}
            value={
              session.warehouse_name ||
              session.warehouse_code ||
              session.warehouse_id
            }
          />
          <InfoTile
            icon={<MapPin className="h-4 w-4" />}
            label={text.location}
            value={
              session.location_name ||
              session.location_code ||
              session.warehouse_location_id
            }
          />
          <InfoTile
            icon={<CalendarDays className="h-4 w-4" />}
            label={text.performedAt}
            value={performedAt.dateTime}
          />
          <InfoTile
            icon={<ClipboardList className="h-4 w-4" />}
            label={text.businessDate}
            value={formatExternalCountBusinessDate(session.business_date, lang)}
          />
          <InfoTile
            icon={<UserRound className="h-4 w-4" />}
            label={text.operator}
            value={
              session.external_operator_name ||
              session.external_operator_id ||
              "-"
            }
          />
          <InfoTile
            icon={<MonitorSmartphone className="h-4 w-4" />}
            label={`${text.client} · ${text.device}`}
            value={[session.external_client_id, session.device_id]
              .filter(Boolean)
              .join(" · ")}
          />
          <InfoTile
            icon={<Hash className="h-4 w-4" />}
            label={text.idempotency}
            value={session.idempotency_key || "-"}
          />
          <InfoTile
            icon={<Package className="h-4 w-4" />}
            label={text.sessionCode}
            value={session.id}
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            {text.countResults}
          </h3>
          <span className="text-xs font-bold tabular-nums text-[var(--color-text-secondary)]">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white p-4 text-center">
            <Package className="h-8 w-8 text-[var(--color-neutral-300)]" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {text.noItems}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item, index) => (
              <ExternalCountItemCard
                key={item.id}
                item={item}
                index={index}
                lang={lang}
                text={text}
                onOpenImages={onOpenImages}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
