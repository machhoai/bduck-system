"use client";

import { gooeyToast } from "goey-toast";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { PartnerInventoryComparisonList } from "./PartnerInventoryComparisonList";

import { usePartnerInventoryMetadata } from "@/hooks/usePartnerInventoryMetadata";
import { usePartnerInventorySync } from "@/hooks/usePartnerInventorySync";
import { useTranslation } from "@/lib/i18n";
import { PARTNER_INVENTORY_TEXT } from "@/lib/i18n/partnerInventoryTranslations";
import { useUserStore } from "@/stores/useUserStore";

export function PartnerInventorySyncModal({
  warehouseId,
  isOpen,
  onClose,
}: {
  warehouseId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { lang } = useTranslation();
  const copy = PARTNER_INVENTORY_TEXT[lang === "zh" ? "zh" : "vi"];
  const canSync = useUserStore((state) =>
    state.hasPermission("partner_inventory.sync", warehouseId),
  );
  const metadata = usePartnerInventoryMetadata(isOpen);
  const sync = usePartnerInventorySync(warehouseId, isOpen);
  const dialogRef = useRef<HTMLElement>(null);
  const busy = sync.syncing || sync.reconciling;
  const syncResults = useMemo(
    () => new Map(sync.job?.items.map((item) => [item.sku, item]) || []),
    [sync.job],
  );

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current
      ?.querySelector<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, isOpen, onClose]);

  if (!isOpen) return null;
  const selectedCount = sync.selectedIds.size;
  const allSelected =
    sync.eligibleIds.length > 0 &&
    sync.eligibleIds.every((id) => sync.selectedIds.has(id));
  const overSelectionLimit = sync.eligibleIds.length > sync.selectionLimit;
  const synchronize = async () => {
    const action = sync.synchronize();
    try {
      await gooeyToast.promise(action, {
        loading: copy.syncLoading,
        success: copy.syncSuccess,
        error: (error: unknown) =>
          error instanceof Error ? error.message : copy.syncError,
        description: {
          success: copy.syncSuccess,
          error: copy.syncError,
        },
      });
    } catch {
      // The hook exposes the detailed API error in the modal.
    }
  };
  const reconcile = async () => {
    const action = sync.reconcile();
    try {
      await gooeyToast.promise(action, {
        loading: copy.reconcileLoading,
        success: copy.reconcileSuccess,
        error: copy.syncError,
      });
    } catch {
      // The hook exposes the detailed API error in the modal.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-inventory-title"
      className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 lg:items-center lg:justify-center lg:p-6"
    >
      <section ref={dialogRef} className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl lg:h-[min(86vh,820px)] lg:max-w-6xl lg:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border-soft)] px-4 py-4 sm:px-6">
          <div>
            <h2 id="partner-inventory-title" className="text-lg font-bold text-[var(--color-text-primary)]">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{copy.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={copy.close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {sync.loading ? (
            <LoadingState label={copy.loading} />
          ) : sync.error && !sync.snapshot ? (
            <ErrorState message={sync.error} retry={copy.retry} onRetry={() => void sync.load().catch(() => undefined)} />
          ) : sync.snapshot ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info label={copy.mappedWarehouse} value={sync.snapshot.partner_stock_name} />
                <Info
                  label={copy.fetchedAt}
                  value={new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  }).format(new Date(sync.snapshot.fetched_at))}
                />
              </div>

              {!metadata.loading && metadata.capability && !metadata.capability.write_enabled && (
                <Notice icon={<AlertTriangle size={18} />} text={copy.writeDisabled} tone="warning" />
              )}
              {sync.error && (
                <Notice
                  icon={<AlertTriangle size={18} />}
                  text={sync.error}
                  tone="warning"
                />
              )}
              {sync.job && (
                <Notice
                  icon={sync.job.status === "COMPLETED" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  text={`${copy.result}: ${copy.jobStatuses[sync.job.status]} · ${sync.job.items.length}`}
                  tone={sync.job.status === "COMPLETED" ? "success" : "warning"}
                />
              )}
              {overSelectionLimit && (
                <Notice
                  icon={<AlertTriangle size={18} />}
                  text={copy.selectionLimit.replace("{limit}", String(sync.selectionLimit))}
                  tone="warning"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={sync.eligibleIds.length === 0 || sync.syncing || overSelectionLimit}
                    onChange={sync.toggleAll}
                    className="h-4 w-4 accent-[var(--color-brand-primary)]"
                  />
                  {allSelected ? copy.clearSelection : copy.selectAll}
                </label>
                <span className="rounded-full bg-[var(--color-neutral-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {copy.selected}: {selectedCount}/{sync.eligibleIds.length}
                </span>
              </div>

              {sync.snapshot.rows.length > 0 ? (
                <PartnerInventoryComparisonList
                  rows={sync.snapshot.rows}
                  selectedIds={sync.selectedIds}
                  onToggle={sync.toggle}
                  copy={copy}
                  selectionLimitReached={selectedCount >= sync.selectionLimit}
                  syncResults={syncResults}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] p-8 text-center text-sm text-[var(--color-text-muted)]">
                  {copy.noRows}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-white px-4 py-4 sm:px-6 lg:rounded-b-3xl">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-[var(--color-border-subtle)] px-5 text-sm font-semibold disabled:opacity-50">
            {copy.close}
          </button>
          {canSync && (
            sync.job?.status === "UNKNOWN" ? (
              <button
                type="button"
                onClick={() => void reconcile()}
                disabled={sync.reconciling}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sync.reconciling && <Loader2 size={16} className="animate-spin" />}
                {copy.reconcile}
              </button>
            ) : (
              <button
              type="button"
              onClick={() => void synchronize()}
              disabled={selectedCount === 0 || sync.syncing || !metadata.capability?.write_enabled}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sync.syncing && <Loader2 size={16} className="animate-spin" />}
              {copy.synchronize} ({selectedCount})
              </button>
            )
          )}
        </footer>
      </section>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
      {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-[var(--color-neutral-100)]" />)}
    </div>
  );
}

function ErrorState({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 font-semibold underline">{retry}</button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[var(--color-neutral-50)] p-3"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 font-semibold text-[var(--color-text-primary)]">{value}</p></div>;
}

function Notice({ icon, text, tone }: { icon: ReactNode; text: string; tone: "warning" | "success" }) {
  return <div role={tone === "warning" ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{icon}<span>{text}</span></div>;
}
