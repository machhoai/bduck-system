"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { format } from "date-fns";
import type { Locale } from "date-fns";
import { vi as viLocale, zhCN } from "date-fns/locale";
import {
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Eye,
  Inbox,
  MapPin,
  PackageCheck,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import {
  externalQueueApi,
  type ExternalQueueAutoSubmitSchedule,
} from "../../../api/externalQueueApi";
import BatchDetailDrawer from "./BatchDetailDrawer";
import AutoSubmitScheduleModal from "./AutoSubmitScheduleModal";

const STATUS_BADGE_MAP: Record<
  string,
  { label: string; className: string; icon: ElementType }
> = {
  QUEUED: {
    label: "externalQueue.statuses.QUEUED",
    className:
      "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
    icon: ScanLine,
  },
  SUBMITTED: {
    label: "externalQueue.statuses.SUBMITTED",
    className:
      "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
    icon: ClipboardCheck,
  },
  REVISION_REQUIRED: {
    label: "externalQueue.statuses.REVISION_REQUIRED",
    className:
      "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
    icon: RefreshCw,
  },
  PENDING_EXPORT_APPROVAL: {
    label: "externalQueue.statuses.PENDING_EXPORT_APPROVAL",
    className:
      "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
    icon: Clock3,
  },
};

const safeParseDate = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === "string" || typeof val === "number") {
    const date = new Date(val);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof val === "object") {
    const raw = val as { seconds?: number; _seconds?: number };
    const seconds = raw.seconds ?? raw._seconds;
    return typeof seconds === "number" ? new Date(seconds * 1000) : null;
  }
  return null;
};

function formatQueueDate(
  value: unknown,
  pattern: string,
  locale: Locale = viLocale,
) {
  const date = safeParseDate(value);
  return date ? format(date, pattern, { locale }) : "-";
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ExternalQueuePendingTab() {
  const { t, lang } = useTranslation();
  const externalQueueText = (t as any).externalQueue;
  const pendingText = externalQueueText.pendingTab;
  const commonText = (t as any).common;
  const dateLocale = lang === "zh" ? zhCN : viLocale;
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canApprove = hasPermission("external_scan.approve");
  const canManageQueue = hasPermission("external_scan.manage_queue");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schedule, setSchedule] =
    useState<ExternalQueueAutoSubmitSchedule | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const fetchBatches = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      const result = await externalQueueApi.getPendingBatches();
      if (result?.data) setData(result.data);
    } catch (error) {
      console.error("Failed to fetch pending batches", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, [fetchBatches]);

  useEffect(() => {
    if (!canManageQueue) return;

    externalQueueApi
      .getAutoSubmitSchedule()
      .then((response) => setSchedule(response.data))
      .catch((error) =>
        console.error("Failed to fetch auto-submit schedule", error),
      );
  }, [canManageQueue]);

  const handleAutoSubmit = async () => {
    if (!canManageQueue || isRefreshing) return;
    const promise = externalQueueApi.autoSubmit();

    gooeyToast.promise(promise, {
      loading: pendingText.autoSubmitLoading,
      success: pendingText.autoSubmitSuccess,
      error: pendingText.autoSubmitError,
      description: {
        success: pendingText.autoSubmitSuccessDesc,
        error: pendingText.autoSubmitErrorDesc,
      },
      action: {
        error: {
          label: commonText.retry,
          onClick: handleAutoSubmit,
        },
      },
    });

    try {
      await promise;
      fetchBatches(true);
    } catch (error) {
      console.error("[ExternalQueuePendingTab] auto submit error", error);
    }
  };

  const pendingBatches = data || [];
  const filteredBatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return pendingBatches;
    return pendingBatches.filter((batch: any) => {
      const operators = Array.isArray(batch.operator_names)
        ? batch.operator_names.join(" ")
        : batch.operator_name;
      return [
        batch.batch_id,
        batch.location_name,
        batch.location_code,
        batch.warehouse_name,
        batch.warehouse_code,
        operators,
        batch.next_approval?.role_name,
        batch.next_approval?.role_id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });
  }, [pendingBatches, searchTerm]);

  const submittedCount = pendingBatches.filter((batch: any) =>
    ["SUBMITTED", "REVISION_REQUIRED"].includes(batch.status),
  ).length;
  const draftCount = pendingBatches.filter(
    (batch: any) => batch.status === "QUEUED" || batch.is_draft,
  ).length;
  const totalQuantity = pendingBatches.reduce(
    (sum, batch: any) => sum + (batch.total_quantity || 0),
    0,
  );
  const canViewBatchPrice = (batch: any) =>
    batch.can_view_price === true &&
    hasPermission("products.price.view", batch.warehouse_id);
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const batch of filteredBatches) {
      const key =
        batch.queue_date || formatQueueDate(batch.shift_date, "yyyy-MM-dd");
      const list = groups.get(key) || [];
      list.push(batch);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredBatches]);

  const statusLabel = (status: string) => {
    const badge = STATUS_BADGE_MAP[status];
    if (!badge) return null;
    const Icon = badge.icon;
    const label = (externalQueueText.statuses as any)?.[status] ?? badge.label;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.className}`}
      >
        <Icon size={12} />
        {label}
      </span>
    );
  };

  if (isLoading && pendingBatches.length === 0) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-2 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]"
            />
          ))}
        </div>
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (pendingBatches.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 text-center">
        <Inbox size={48} className="mb-4 text-[var(--color-neutral-300)]" />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {pendingText.emptyTitle}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {pendingText.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid gap-2 md:grid-cols-3">
        <Metric
          label={pendingText.metrics.submitted}
          value={submittedCount.toLocaleString()}
          icon={ClipboardCheck}
        />
        <Metric
          label={pendingText.metrics.draft}
          value={draftCount.toLocaleString()}
          icon={ScanLine}
        />
        <Metric
          label={pendingText.metrics.totalQuantity}
          value={totalQuantity.toLocaleString()}
          icon={PackageCheck}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
        <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full flex -1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder={pendingText.searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
            />
          </div>
          <div className="flex  gap-2 flex-1 shrink-0">
            {canManageQueue && (
              <>
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(true)}
                  title={
                    schedule?.enabled && schedule.times.length > 0
                      ? `GMT+7 ${schedule.times.join(", ")}`
                      : pendingText.scheduleButton
                  }
                  className="inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] sm:max-w-72"
                >
                  <Settings className="h-4 w-4" />
                  <span className="truncate">
                    {schedule?.enabled && schedule.times.length > 0
                      ? `GMT+7 ${schedule.times.join(", ")}`
                      : pendingText.scheduleButton}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoSubmit}
                  disabled={isRefreshing}
                  className="inline-flex w-fit max-w-fit h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="truncate">{pendingText.autoSubmit}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => fetchBatches(true)}
              disabled={isRefreshing}
              className="inline-flex h-9 w-fit max-w-fit items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4  ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="truncate">{pendingText.refresh}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-3">
          {filteredBatches.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-sm text-[var(--color-text-muted)]">
              {pendingText.noSearchResults}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([dateKey, batches]) => (
                <section key={dateKey} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                    <CalendarDays className="h-4 w-4" />
                    {formatQueueDate(
                      `${dateKey}T00:00:00`,
                      "EEEE, dd/MM/yyyy",
                      dateLocale,
                    )}
                  </div>

                  <div className="space-y-2">
                    {batches.map((batch: any) => {
                      const isDraft =
                        batch.is_draft || batch.status === "QUEUED";
                      const isRevision = batch.status === "REVISION_REQUIRED";
                      const isWaitingExportApproval =
                        batch.status === "PENDING_EXPORT_APPROVAL";
                      const nextApproval = batch.next_approval;
                      const canActOnNextApproval =
                        nextApproval?.can_act === true;
                      const operators = Array.isArray(batch.operator_names)
                        ? batch.operator_names.filter(Boolean)
                        : [batch.operator_name].filter(Boolean);
                      const canOpen = isDraft
                        ? canManageQueue
                        : isWaitingExportApproval
                          ? canActOnNextApproval || canApprove || canManageQueue
                          : canApprove || (isRevision && canManageQueue);
                      const timeLabel = isDraft
                        ? formatQueueDate(
                            batch.last_scan_time || batch.shift_date,
                            "HH:mm",
                            dateLocale,
                          )
                        : formatQueueDate(
                            batch.submitted_at,
                            "HH:mm dd/MM/yyyy",
                            dateLocale,
                          );
                      const canViewPrice = canViewBatchPrice(batch);
                      const nextApprovalRole =
                        nextApproval?.role_name || nextApproval?.role_id;

                      return (
                        <div
                          key={batch.batch_id}
                          className="rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-sm transition hover:border-[var(--color-border-focus)]"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {statusLabel(batch.status)}
                                <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                  {batch.location_name ||
                                    batch.location_code ||
                                    batch.warehouse_location_id}
                                </span>
                                {batch.location_code && (
                                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                    {batch.location_code}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                  <span className="truncate">
                                    {batch.warehouse_name ||
                                      batch.warehouse_code ||
                                      batch.warehouse_id}
                                  </span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2">
                                  <Users className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                  <span className="truncate">
                                    {operators.length > 0
                                      ? operators.join(", ")
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2">
                                  <Clock3 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                  <span className="truncate">
                                    {isDraft
                                      ? `${pendingText.latestScanPrefix} ${timeLabel}`
                                      : `${pendingText.submittedAtPrefix} ${timeLabel}`}
                                  </span>
                                </div>
                              </div>
                              {nextApproval && (
                                <div className="mt-2 flex min-w-0 items-center gap-2 rounded-md border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] px-2.5 py-1.5 text-xs text-[var(--color-status-pending-text)]">
                                  <ShieldCheck className="h-4 w-4 shrink-0" />
                                  <span className="truncate">
                                    {pendingText.nextApproval ||
                                      "Cấp duyệt tiếp theo"}
                                    :{" "}
                                    <strong>
                                      {pendingText.approvalLevel || "Cấp"}{" "}
                                      {nextApproval.level}
                                    </strong>
                                    {nextApprovalRole
                                      ? ` · ${nextApprovalRole}`
                                      : ""}
                                    {nextApproval.required_count > 1
                                      ? ` · ${nextApproval.approved_count}/${nextApproval.required_count} ${pendingText.approvedProgress || "đã duyệt"}`
                                      : ""}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div
                              className={`grid gap-2 ${
                                canViewPrice
                                  ? "grid-cols-3 lg:w-[360px]"
                                  : "grid-cols-2 lg:w-60"
                              }`}
                            >
                              <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                  {pendingText.sku}
                                </p>
                                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                  {(batch.total_products || 0).toLocaleString()}
                                </p>
                              </div>
                              <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                  {pendingText.quantityShort}
                                </p>
                                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                  {(batch.total_quantity || 0).toLocaleString()}
                                </p>
                              </div>
                              {canViewPrice && (
                                <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                  <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                    {pendingText.money}
                                  </p>
                                  <p className="text-sm font-bold text-[var(--color-brand-primary)]">
                                    {Number(
                                      batch.total_value || 0,
                                    ).toLocaleString("vi-VN")}
                                    đ
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end lg:w-28">
                              {canOpen ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedBatchId(batch.batch_id)
                                  }
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)]"
                                >
                                  <Eye className="h-4 w-4" />
                                  {pendingText.open}
                                </button>
                              ) : (
                                <span className="inline-flex h-9 items-center text-xs text-[var(--color-text-muted)]">
                                  {isDraft
                                    ? pendingText.scanning
                                    : pendingText.readOnly}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedBatchId && (
        <BatchDetailDrawer
          batchId={selectedBatchId}
          batchData={pendingBatches.find(
            (batch: any) => batch.batch_id === selectedBatchId,
          )}
          readonly={(() => {
            const selectedBatch = pendingBatches.find(
              (batch: any) => batch.batch_id === selectedBatchId,
            );
            return (
              selectedBatch?.status === "PENDING_EXPORT_APPROVAL" &&
              selectedBatch?.next_approval?.can_act !== true
            );
          })()}
          onClose={() => setSelectedBatchId(null)}
          onSuccess={() => {
            setSelectedBatchId(null);
            fetchBatches();
          }}
        />
      )}

      {isScheduleOpen && (
        <AutoSubmitScheduleModal
          schedule={schedule}
          onClose={() => setIsScheduleOpen(false)}
          onSaved={setSchedule}
        />
      )}
    </div>
  );
}
