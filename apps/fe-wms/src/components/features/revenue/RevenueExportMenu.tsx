"use client";

import type {
  RevenueDashboardFilter,
  RevenueDataSource,
  RevenueExportReportType,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { downloadBlob } from "@/utils/reportExcelClient";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface RevenueExportMenuProps {
  source: RevenueDataSource;
  warehouseId: string;
  filter: RevenueDashboardFilter;
}

export default function RevenueExportMenu({
  source,
  warehouseId,
  filter,
}: RevenueExportMenuProps) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.export;
  const canExport = useUserStore((state) =>
    state.hasPermission("revenue.export", warehouseId),
  );
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<RevenueExportReportType | null>(null);

  const runExport = async (reportType: RevenueExportReportType) => {
    if (!canExport || exporting) return;
    setOpen(false);
    setExporting(reportType);
    const action = async () => {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/revenue/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filter,
          source,
          warehouseId,
          reportType,
          locale: lang,
          actionTime: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.messages?.[lang] ?? copy.errorDescription;
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/u)?.[1] ??
        `revenue-${reportType.toLowerCase()}.xlsx`;
      downloadBlob(blob, fileName);
    };

    try {
      await gooeyToast.promise(action(), {
        loading: copy.loading,
        success: copy.success,
        error: copy.error,
        description: {
          success: copy.successDescription,
          error: copy.errorDescription,
        },
        action: {
          error: {
            label: copy.retry,
            onClick: () => void runExport(reportType),
          },
        },
      });
    } catch (error) {
      console.error("[RevenueExportMenu] export failed:", error);
    } finally {
      setExporting(null);
    }
  };

  if (!canExport) {
    return (
      <span className="text-xs font-medium text-[var(--color-text-muted)]">
        {copy.noPermission}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={Boolean(exporting) || !warehouseId}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download size={16} aria-hidden="true" />
        {copy.button}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-1.5 shadow-xl">
          <ExportOption
            label={copy.dailyRevenue}
            disabled={Boolean(exporting)}
            onClick={() => void runExport("DAILY_REVENUE")}
          />
          <ExportOption
            label={copy.salesComposition}
            disabled={Boolean(exporting)}
            onClick={() => void runExport("SALES_COMPOSITION")}
          />
        </div>
      )}
    </div>
  );
}

function ExportOption({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-card)] disabled:opacity-50"
    >
      <FileSpreadsheet
        size={18}
        className="text-emerald-600"
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
