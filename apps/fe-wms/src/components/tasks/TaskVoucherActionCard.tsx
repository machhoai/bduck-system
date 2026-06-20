"use client";

import {
  ArrowDownRight,
  ArrowRightCircle,
  ArrowUpCircle,
  Calendar,
  CheckCircle,
  Eye,
  Play,
  User,
  Warehouse,
} from "lucide-react";
import type { UnifiedVoucher } from "@/types/unified-voucher";
import { getStatusStyle } from "@/components/ui/StatusBadge";

type ActionMode = "sessions" | "completions";

interface TaskVoucherActionCardProps {
  voucher: UnifiedVoucher;
  mode: ActionMode;
  entityLabel: string;
  statusLabel: string;
  warehouseName: string;
  creatorName: string;
  createdAtLabel: string;
  actionLabel: string;
  viewLabel: string;
  onView: () => void;
  onAction: () => void;
}

function getVoucherIcon(voucher: UnifiedVoucher) {
  if (voucher.type === "IMPORT") return ArrowDownRight;
  if (voucher.type === "EXPORT") return ArrowUpCircle;
  return ArrowRightCircle;
}

export default function TaskVoucherActionCard({
  voucher,
  mode,
  entityLabel,
  statusLabel,
  warehouseName,
  creatorName,
  createdAtLabel,
  actionLabel,
  viewLabel,
  onView,
  onAction,
}: TaskVoucherActionCardProps) {
  const Icon = getVoucherIcon(voucher);
  const statusColor = getStatusStyle(voucher.status);

  return (
    <article className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm transition-all hover:border-[var(--color-brand-primary-muted)] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 aspect-square shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-1 ring-[var(--color-status-approved-border)]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
              {entityLabel}
            </p>
            <h3 className="mt-1 truncate text-base font-bold text-[var(--color-text-primary)]">
              {voucher.voucher_number}
            </h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <Warehouse className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span className="truncate">{warehouseName}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span className="truncate">{creatorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span>{createdAtLabel}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
        <button
          type="button"
          onClick={onView}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-50)]"
        >
          <Eye className="h-4 w-4" />
          {viewLabel}
        </button>
        <button
          type="button"
          onClick={onAction}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-[var(--color-text-on-dark)] transition-colors hover:opacity-90"
        >
          {mode === "completions" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
