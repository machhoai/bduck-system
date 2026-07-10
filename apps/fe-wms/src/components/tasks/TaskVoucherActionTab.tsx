"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PackageOpen,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ProcessConfig } from "@bduck/shared-types";
import type { UnifiedVoucher } from "@/types/unified-voucher";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUsers } from "@/hooks/useUsers";
import { useUserStore } from "@/stores/useUserStore";
import { fetchConfigByEntityType } from "@/hooks/useApprovalApi";
import { completeExportVoucher } from "@/hooks/useExportVoucherApi";
import { useTranslation } from "@/lib/i18n";
import VoucherDetailDrawer from "@/components/features/import-vouchers/VoucherDetailDrawer";
import TransferDetailDrawer from "@/components/features/transfers/TransferDetailDrawer";
import ReceivingSessionDrawer from "./ReceivingSessionDrawer";
import PickingSessionDrawer from "./PickingSessionDrawer";
import TaskVoucherActionCard from "./TaskVoucherActionCard";
import {
  formatVoucherDateTime,
  isCompletionVoucher,
  isSessionVoucher,
} from "./taskVoucherActionUtils";

type ActionMode = "sessions" | "completions";

interface TaskVoucherActionTabProps {
  mode: ActionMode;
  vouchers: UnifiedVoucher[];
  loading: boolean;
}

export default function TaskVoucherActionTab({
  mode,
  vouchers: activeVouchers,
  loading,
}: TaskVoucherActionTabProps) {
  const { t } = useTranslation();
  const { warehouses } = useWarehouses();
  const { users } = useUsers();
  const user = useUserStore((state) => state.user);
  const hasScopedRole = useUserStore((state) => state.hasScopedRole);
  const hasPermission = useUserStore((state) => state.hasPermission);

  const [importConfig, setImportConfig] = useState<ProcessConfig | null>(null);
  const [exportConfig, setExportConfig] = useState<ProcessConfig | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<UnifiedVoucher | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [receivingVoucherId, setReceivingVoucherId] = useState<string | null>(null);
  const [pickingVoucherId, setPickingVoucherId] = useState<string | null>(null);
  const [receivingTransferId, setReceivingTransferId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    Promise.all([
      fetchConfigByEntityType("IMPORT_VOUCHER").catch(() => null),
      fetchConfigByEntityType("EXPORT_VOUCHER").catch(() => null),
    ]).then(([importCfg, exportCfg]) => {
      if (disposed) return;
      if (importCfg) setImportConfig(importCfg as ProcessConfig);
      if (exportCfg) setExportConfig(exportCfg as ProcessConfig);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const userById = useMemo(
    () => new Map(users.map((item) => [item.id, item])),
    [users],
  );

  const canPerformSession = (voucher: UnifiedVoucher) => {
    if (hasPermission("admin")) return true;

    if (voucher.type === "IMPORT") {
      const step = importConfig?.step_options?.receiving;
      if (!step) return true;
      if (step.assignment_mode === "CREATOR") return user?.id === voucher.creator_id;
      if (step.assignment_mode === "ROLE") {
        return hasScopedRole(step.assigned_role_id, voucher.warehouse_id, {
          allowGlobalFallback: step.allow_global_fallback === true,
          requireGlobal: step.assignment_scope === "GLOBAL",
        });
      }
      return true;
    }

    if (voucher.type === "EXPORT") {
      const step = exportConfig?.step_options?.picking;
      if (!step) return true;
      if (step.assignment_mode === "CREATOR") return user?.id === voucher.creator_id;
      if (step.assignment_mode === "ROLE") {
        return hasScopedRole(step.assigned_role_id, voucher.warehouse_id, {
          allowGlobalFallback: step.allow_global_fallback === true,
          requireGlobal: step.assignment_scope === "GLOBAL",
        });
      }
      return true;
    }

    return (
      hasPermission("transfers.write") ||
      hasPermission("vouchers.write") ||
      hasPermission("vouchers.force_cancel")
    );
  };

  const vouchers = useMemo(() => {
    const predicate = mode === "sessions" ? isSessionVoucher : isCompletionVoucher;
    return activeVouchers.filter(predicate);
  }, [activeVouchers, mode]);

  const visibleVouchers = useMemo(
    () => (mode === "sessions" ? vouchers.filter(canPerformSession) : vouchers),
    [mode, vouchers, importConfig, exportConfig, user?.id, hasScopedRole, hasPermission],
  );

  const handleCompleteExport = async (voucherId: string) => {
    const exportText = t.exportVoucher as any;
    await gooeyToast.promise(completeExportVoucher(voucherId), {
      loading: exportText.toast?.completing ?? t.tasks.workbench.completingExport,
      success: exportText.toast?.completeSuccess ?? t.tasks.workbench.completeExportSuccess,
      error: exportText.toast?.completeError ?? t.tasks.workbench.completeExportError,
      description: {
        success:
          exportText.toast?.completeSuccessDesc ??
          t.tasks.workbench.completeExportSuccessDesc,
        error: t.common.retry,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void handleCompleteExport(voucherId),
        },
      },
    });
  };

  const openAction = (voucher: UnifiedVoucher) => {
    if (mode === "completions") {
      void handleCompleteExport(voucher.id);
      return;
    }

    if (voucher.type === "IMPORT") {
      setReceivingVoucherId(voucher.id);
    } else if (voucher.type === "EXPORT") {
      setPickingVoucherId(voucher.id);
    } else {
      setReceivingTransferId(voucher.id);
    }
  };

  const emptyTitle =
    mode === "sessions"
      ? t.tasks.workbench.emptySessionTitle
      : t.tasks.workbench.emptyCompletionTitle;
  const emptyHint =
    mode === "sessions"
      ? t.tasks.workbench.emptySessionHint
      : t.tasks.workbench.emptyCompletionHint;

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 shadow-sm"
          >
            <div className="h-4 w-32 rounded bg-[var(--color-skeleton-base)]" />
            <div className="mt-3 h-3 w-48 rounded bg-[var(--color-neutral-100)]" />
            <div className="mt-5 h-10 rounded bg-[var(--color-neutral-100)]" />
          </div>
        ))}
      </div>
    );
  }

  if (visibleVouchers.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-neutral-50)]">
          <PackageOpen className="h-7 w-7 text-[var(--color-neutral-300)]" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">
          {emptyTitle}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{emptyHint}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {visibleVouchers.map((voucher) => {
          const warehouse = warehouseById.get(voucher.warehouse_id);
          const creator = userById.get(voucher.creator_id);
          const statusLabel =
            (t.importVoucher.status as any)[voucher.status] ||
            (t.exportVoucher.status as any)[voucher.status] ||
            (t.transfer.status as any)[voucher.status] ||
            voucher.status;
          const entityLabel =
            voucher.type === "IMPORT"
              ? t.tasks.entityType.IMPORT_VOUCHER
              : voucher.type === "EXPORT"
                ? t.tasks.entityType.EXPORT_VOUCHER
                : t.tasks.entityType.TRANSFER_ORDER;
          const actionLabel =
            mode === "completions"
              ? t.tasks.workbench.completeAction
              : voucher.type === "TRANSFER"
                ? t.tasks.workbench.receiveTransferAction
                : t.tasks.workbench.openSessionAction;

          return (
            <TaskVoucherActionCard
              key={voucher.id}
              voucher={voucher}
              mode={mode}
              entityLabel={entityLabel}
              statusLabel={statusLabel}
              warehouseName={warehouse?.name || t.tasks.workbench.unknownWarehouse}
              creatorName={creator?.full_name || creator?.email || voucher.creator_id}
              createdAtLabel={formatVoucherDateTime(voucher.created_at) || t.common.noData}
              actionLabel={actionLabel}
              viewLabel={t.tasks.workbench.viewDetail}
              onView={() => {
                if (voucher.type === "TRANSFER") setSelectedTransferId(voucher.id);
                else setSelectedVoucher(voucher);
              }}
              onAction={() => openAction(voucher)}
            />
          );
        })}
      </div>

      {selectedVoucher && (
        <VoucherDetailDrawer
          voucher={selectedVoucher.raw as any}
          onClose={() => setSelectedVoucher(null)}
          mobileBottomSheet
        />
      )}

      {selectedTransferId && (
        <TransferDetailDrawer
          orderId={selectedTransferId}
          onClose={() => setSelectedTransferId(null)}
          readOnly
          mobileBottomSheet
        />
      )}

      {receivingTransferId && (
        <TransferDetailDrawer
          orderId={receivingTransferId}
          onClose={() => setReceivingTransferId(null)}
          mobileBottomSheet
        />
      )}

      {receivingVoucherId &&
        (() => {
          const voucher = visibleVouchers.find((item) => item.id === receivingVoucherId);
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
              mobileBottomSheet
            />
          );
        })()}

      {pickingVoucherId && (
        <PickingSessionDrawer
          voucherId={pickingVoucherId}
          onClose={() => setPickingVoucherId(null)}
          mobileBottomSheet
        />
      )}
    </>
  );
}
