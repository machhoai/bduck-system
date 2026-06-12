"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, type Locale } from "date-fns";
import { vi, zhCN } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle,
  History,
  PackageCheck,
  Search,
  User,
  XCircle,
} from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { externalQueueApi } from "../../../api/externalQueueApi";

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object") {
    const raw = value as { seconds?: number; _seconds?: number };
    const seconds = raw.seconds ?? raw._seconds;
    return typeof seconds === "number" ? new Date(seconds * 1000) : null;
  }
  return null;
}

function formatDate(value: unknown, pattern: string, locale: Locale) {
  const date = safeDate(value);
  return date ? format(date, pattern, { locale }) : "-";
}

export default function ExternalQueueHistoryTab() {
  const { t, lang } = useTranslation();
  const externalQueueText = (t as any).externalQueue;
  const historyText = externalQueueText.historyTab;
  const dateLocale = lang === "zh" ? zhCN : vi;
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const result = await externalQueueApi.getHistory();
      if (result?.data) setData(result.data);
    } catch (error) {
      console.error("[ExternalQueueHistoryTab] fetch failed", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const historyBatches = data || [];
  const filteredBatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return historyBatches;
    return historyBatches.filter((batch: any) =>
      [
        batch.batch_id,
        batch.operator_name,
        batch.location_name,
        batch.warehouse_name,
        batch.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    );
  }, [historyBatches, searchTerm]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const batch of filteredBatches) {
      const key = formatDate(
        batch.shift_date || batch.approved_at || batch.processed_at,
        "yyyy-MM-dd",
        dateLocale,
      );
      const list = groups.get(key) || [];
      list.push(batch);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [dateLocale, filteredBatches]);

  if (isLoading && historyBatches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (historyBatches.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white">
        <History size={48} className="mb-4 text-[var(--color-neutral-300)]" />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {historyText.emptyTitle}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {historyText.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
      <div className="border-b border-[var(--color-border-subtle)] p-3">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder={historyText.searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-3">
        {filteredBatches.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-sm text-[var(--color-text-muted)]">
            {historyText.noResults}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(([dateKey, batches]) => (
              <section key={dateKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(
                    `${dateKey}T00:00:00`,
                    "EEEE, dd/MM/yyyy",
                    dateLocale,
                  )}
                </div>

                <div className="space-y-2">
                  {batches.map((batch: any) => {
                    const isApproved =
                      batch.status === "APPROVED" ||
                      batch.status === "EXPORTED";
                    const StatusIcon = isApproved ? CheckCircle : XCircle;
                    const processedAt = batch.processed_at || batch.approved_at;

                    return (
                      <div
                        key={batch.batch_id}
                        className="rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                  isApproved
                                    ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                    : "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                                }`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {isApproved
                                  ? historyText.processed
                                  : historyText.rejected}
                              </span>
                              <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                {batch.location_name || batch.batch_id}
                              </span>
                            </div>

                            <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <User className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                <span className="truncate">
                                  {batch.operator_name ||
                                    historyText.unknownOperator}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center gap-2">
                                <PackageCheck className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                <span>
                                  {(batch.total_quantity || 0).toLocaleString()}{" "}
                                  {historyText.products}
                                </span>
                              </div>
                              <div className="truncate text-[var(--color-text-muted)]">
                                {historyText.processedAt}
                                {formatDate(
                                  processedAt,
                                  "HH:mm dd/MM/yyyy",
                                  dateLocale,
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                              {historyText.batch}
                            </p>
                            <p className="max-w-[240px] truncate text-sm font-semibold text-[var(--color-text-primary)]">
                              {batch.batch_id}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              {batch.processed_by_name ||
                                batch.approved_by_name ||
                                historyText.unknownOperator}
                            </p>
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
  );
}
