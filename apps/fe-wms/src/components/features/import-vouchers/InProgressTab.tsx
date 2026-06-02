"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  Copy,
  Eye,
  PackageOpen,
  Play,
  XCircle,
} from "lucide-react";
import type { ImportVoucher, ProcessConfig } from "@bduck/shared-types";
import { ImportVoucherStatus } from "@bduck/shared-types";
import { fetchConfigByEntityType } from "../../../hooks/useApprovalApi";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import ReceivingSessionDrawer from "../../tasks/ReceivingSessionDrawer";
import VoucherDetailDrawer from "./VoucherDetailDrawer";

interface InProgressTabProps {
  vouchers: ImportVoucher[];
  onClone: (data: Record<string, unknown>) => void;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; Icon: React.ElementType }
> = {
  DRAFT: { color: "bg-gray-100 text-gray-600", Icon: Clock },
  PENDING_APPROVAL: { color: "bg-amber-50 text-amber-700", Icon: Clock },
  APPROVED: { color: "bg-blue-50 text-blue-700", Icon: CheckCircle },
  REJECTED: { color: "bg-red-50 text-red-700", Icon: XCircle },
  RECEIVING: { color: "bg-indigo-50 text-indigo-700", Icon: PackageOpen },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xxs font-semibold ${cfg.color}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date =
    typeof value === "string"
      ? new Date(value)
      : ((value as { toDate?: () => Date })?.toDate?.() ?? (value as Date));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InProgressTab({
  vouchers,
  onClone,
}: InProgressTabProps) {
  const { t } = useTranslation();
  const importText = t.importVoucher as any;
  const { warehouses } = useWarehouses();
  const user = useUserStore((state) => state.user);
  const roleIds = useUserStore((state) => state.roleIds);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receivingVoucherId, setReceivingVoucherId] = useState<string | null>(
    null,
  );
  const [processConfig, setProcessConfig] = useState<ProcessConfig | null>(
    null,
  );

  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const config = await fetchConfigByEntityType("IMPORT_VOUCHER");
        if (!disposed) setProcessConfig(config as ProcessConfig);
      } catch (error) {
        console.error("[InProgressTab] Failed to load process config:", error);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const canPerformReceiving = (voucher: ImportVoucher): boolean => {
    if (!processConfig?.step_options?.receiving) return true;
    const step = processConfig.step_options.receiving;
    if (step.assignment_mode === "CREATOR") {
      return user?.id === voucher.creator_id;
    }
    if (step.assignment_mode === "ROLE") {
      return !!step.assigned_role_id && roleIds.includes(step.assigned_role_id);
    }
    return true;
  };

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <PackageOpen size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {importText.empty.inProgress}
        </p>
        <p className="w-full text-xs leading-5 text-[var(--color-text-muted)]">
          {importText.empty.inProgressHint}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {vouchers.map((voucher) => {
        const warehouse = warehouseById.get(voucher.warehouse_id);
        const isDraft = voucher.status === ImportVoucherStatus.DRAFT;
        const isApproved = voucher.status === ImportVoucherStatus.APPROVED;
        const canContinue = isApproved && canPerformReceiving(voucher);
        const statusLabel =
          importText.status?.[voucher.status] ?? voucher.status;

        return (
          <article
            key={voucher.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">
                    {voucher.voucher_number}
                  </p>
                  <StatusBadge status={voucher.status} label={statusLabel} />
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {voucher.supplier_name}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {warehouse?.name ?? voucher.warehouse_id}
                  {warehouse?.code ? ` / ${warehouse.code}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-right text-xxs tabular-nums text-[var(--color-text-muted)]">
                {formatDate(voucher.created_at)}
              </p>
            </div>

            {voucher.notes && (
              <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {importText.form.notes}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {voucher.notes}
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedId(voucher.id)}
                className="flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] sm:h-8 sm:text-xs"
              >
                <Eye size={14} />
                {importText.actions.viewDetail}
              </button>

              {isDraft && (
                <button
                  type="button"
                  onClick={() =>
                    onClone({
                      warehouse_id: voucher.warehouse_id,
                      supplier_name: voucher.supplier_name,
                      purchase_order_id: voucher.purchase_order_id,
                      notes: voucher.notes,
                    })
                  }
                  className="flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 sm:h-8 sm:text-xs"
                >
                  <Copy size={14} />
                  {importText.actions.editVoucher}
                </button>
              )}

              {canContinue && (
                <button
                  type="button"
                  onClick={() => setReceivingVoucherId(voucher.id)}
                  className="flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 sm:h-8 sm:text-xs"
                >
                  <Play size={14} />
                  {importText.actions.continue}
                </button>
              )}
            </div>
          </article>
        );
      })}

      {selectedId &&
        (() => {
          const selected = vouchers.find(
            (voucher) => voucher.id === selectedId,
          );
          if (!selected) return null;
          return (
            <VoucherDetailDrawer
              voucher={selected}
              onClose={() => setSelectedId(null)}
            />
          );
        })()}

      {receivingVoucherId &&
        (() => {
          const voucher = vouchers.find(
            (item) => item.id === receivingVoucherId,
          );
          if (!voucher) return null;
          return (
            <ReceivingSessionDrawer
              task={
                {
                  id: `receiving-${voucher.id}`,
                  instance_id: voucher.id,
                  entity_id: voucher.id,
                  entity_type: "IMPORT_VOUCHER",
                  voucher_id: voucher.id,
                } as any
              }
              onClose={() => setReceivingVoucherId(null)}
            />
          );
        })()}
    </div>
  );
}
