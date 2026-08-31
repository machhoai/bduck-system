"use client";

import { gooeyToast } from "goey-toast";
import { FileSpreadsheet } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useExportStore } from "@/stores/useExportStore";
import type { ExportRequestOptions } from "@/utils/exportExcel";

const RevenueExportModal = dynamic(() =>
  import("./RevenueExportModal").then((module) => module.RevenueExportModal),
);
const WarehouseExportModal = dynamic(() =>
  import("./WarehouseExportModal").then(
    (module) => module.WarehouseExportModal,
  ),
);

export function TopBarExportControl() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { exportConfig, isExporting, triggerExport } = useExportStore();

  const runExport = async (options?: ExportRequestOptions) => {
    const toastCopy = exportConfig?.toast ?? {
      loading: t.common.exporting,
      success: t.common.exportSuccess,
      successDescription: t.common.exportSuccessDescription,
      error: t.common.exportError,
      errorDescription: t.common.exportErrorDescription,
      retry: t.common.retry,
    };
    const exportTask = triggerExport(options);
    gooeyToast.promise(exportTask, {
      loading: toastCopy.loading,
      success: toastCopy.success,
      error: toastCopy.error,
      preset: "snappy",
      description: {
        success: toastCopy.successDescription,
        error: toastCopy.errorDescription,
      },
      action: {
        error: {
          label: toastCopy.retry,
          onClick: () => void runExport(options),
        },
      },
    });

    try {
      await exportTask;
      setIsModalOpen(false);
    } catch (error) {
      console.error("[TopBarExportControl] export failed:", error);
    }
  };

  return (
    <>
      <div className="z-50 hidden overflow-hidden md:block">
        <button
          id="wms-export-button"
          type="button"
          onClick={() => {
            if (exportConfig?.dialog) {
              setIsModalOpen(true);
              return;
            }
            void runExport();
          }}
          disabled={isExporting || !exportConfig}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-full bg-green-600 px-3 text-[var(--color-text-on-dark)] shadow-sm transition-all duration-300 hover:bg-green-700 disabled:opacity-50 ${exportConfig ? "" : "translate-x-[120px]"}`}
          title={t.common.exportExcel}
        >
          <FileSpreadsheet size={17} aria-hidden="true" />
          <span className="text-sm font-medium">{t.common.exportExcel}</span>
        </button>
      </div>

      {exportConfig?.dialog?.type === "warehouse" && (
        <WarehouseExportModal
          isOpen={isModalOpen}
          config={exportConfig.dialog}
          isExporting={isExporting}
          onClose={() => setIsModalOpen(false)}
          onSubmit={runExport}
        />
      )}
      {exportConfig?.dialog?.type === "revenue" && (
        <RevenueExportModal
          isOpen={isModalOpen}
          config={exportConfig.dialog}
          isExporting={isExporting}
          onClose={() => setIsModalOpen(false)}
          onSubmit={runExport}
        />
      )}
    </>
  );
}
