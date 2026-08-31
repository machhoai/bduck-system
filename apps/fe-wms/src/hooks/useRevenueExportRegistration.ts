import type {
  RevenueDashboardFilter,
  RevenueDataSource,
  RevenueExportRequest,
} from "@bduck/shared-types";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import type { RegisteredExportConfig } from "@/utils/exportExcel";
import { downloadRevenueExport } from "@/utils/revenueExportClient";

import { useExportRegistration } from "./useExportRegistration";

interface RevenueExportRegistrationOptions {
  source: RevenueDataSource;
  warehouseId: string;
  warehouseName?: string;
  rangeLabel?: string;
  filter: RevenueDashboardFilter;
}

export function useRevenueExportRegistration({
  source,
  warehouseId,
  warehouseName,
  rangeLabel,
  filter,
}: RevenueExportRegistrationOptions) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.export;
  const canExport = useUserStore((state) =>
    state.hasPermission("revenue.export", warehouseId),
  );

  const config = useMemo<RegisteredExportConfig | null>(() => {
    if (!warehouseId || !canExport) return null;

    return {
      entityType: "revenue",
      warehouseId,
      dialog: {
        type: "revenue",
        title: copy.modalTitle,
        description: copy.modalDescription,
        warehouseName,
        sourceLabel:
          source === "OPEN_API"
            ? t.revenue.sources.openApi
            : t.revenue.sources.localPos,
        rangeLabel,
      },
      toast: {
        loading: copy.loading,
        success: copy.success,
        successDescription: copy.successDescription,
        error: copy.error,
        errorDescription: copy.errorDescription,
        retry: copy.retry,
      },
      execute: async ({ reportType }) => {
        if (!reportType) throw new Error(copy.selectReportType);

        const request: RevenueExportRequest = {
          ...filter,
          source,
          warehouseId,
          reportType,
          locale: lang === "zh" ? "zh" : "vi",
          actionTime: new Date().toISOString(),
        };
        await downloadRevenueExport(request, copy.errorDescription);
      },
    };
  }, [
    canExport,
    copy,
    filter,
    lang,
    rangeLabel,
    source,
    t.revenue.sources.localPos,
    t.revenue.sources.openApi,
    warehouseId,
    warehouseName,
  ]);

  useExportRegistration(config);
}
