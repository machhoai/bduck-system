import type {
  RevenueDashboardFilter,
  RevenueDataSource,
  RevenueExportRequest,
  RevenueDashboardData,
} from "@bduck/shared-types";
import { getRevenueProductKey } from "@bduck/shared-types";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import type { RegisteredExportConfig } from "@/utils/exportExcel";
import { downloadRevenueExport } from "@/utils/revenueExportClient";

import { useExportRegistration } from "./useExportRegistration";

interface RevenueExportRegistrationOptions {
  source: RevenueDataSource;
  warehouseId: string;
  warehouseIds?: readonly string[];
  warehouseName?: string;
  rangeLabel?: string;
  filter: RevenueDashboardFilter;
  dashboard?: RevenueDashboardData | null;
  loading?: boolean;
  error?: string | null;
}

export function useRevenueExportRegistration({
  source,
  warehouseId,
  warehouseIds,
  warehouseName,
  rangeLabel,
  filter,
  dashboard,
  loading,
  error,
}: RevenueExportRegistrationOptions) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.export;
  const userId = useUserStore((state) => state.user?.id ?? "");
  const canExport = useUserStore((state) =>
    (warehouseIds?.length ? warehouseIds : [warehouseId]).every((id) =>
      state.hasPermission("revenue.export", id),
    ),
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
        source,
        contextKey: JSON.stringify([
          userId,
          source,
          warehouseId,
          warehouseIds,
          filter,
        ]),
        products: (dashboard?.topProductGroups ?? []).flatMap((group) =>
          group.items.map((item) => ({
            key: getRevenueProductKey(group.groupName, item.name),
            name: item.name,
            groupName: group.groupName,
            quantity: item.quantity,
            revenue: item.revenue,
          })),
        ),
        productsLoading: loading,
        productsError: error,
      },
      toast: {
        loading: copy.loading,
        success: copy.success,
        successDescription: copy.successDescription,
        error: copy.error,
        errorDescription: copy.errorDescription,
        retry: copy.retry,
      },
      execute: async ({ reportType, products, roundMoney }) => {
        if (!reportType) throw new Error(copy.selectReportType);

        const request: RevenueExportRequest = {
          ...filter,
          source,
          warehouseId,
          reportType,
          locale: lang === "zh" ? "zh" : "vi",
          actionTime: new Date().toISOString(),
          products: reportType === "DAILY_REVENUE" ? undefined : products,
          roundMoney:
            reportType === "INVOICE_PREPARATION" ? roundMoney : undefined,
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
    warehouseIds,
    dashboard,
    loading,
    error,
    userId,
  ]);

  useExportRegistration(config);
}
