import { create } from "zustand";
import { exportToExcel } from "../utils/exportExcel";
import type { ExportConfig, ExportRequestOptions } from "../utils/exportExcel";

interface ExportStore {
  exportConfig: ExportConfig | null;
  isExporting: boolean;
  setExportConfig: (config: ExportConfig | null) => void;
  triggerExport: (options?: ExportRequestOptions) => Promise<void>;
}

export const useExportStore = create<ExportStore>((set, get) => ({
  exportConfig: null,
  isExporting: false,
  setExportConfig: (config) => set({ exportConfig: config }),
  triggerExport: async (options = {}) => {
    const { exportConfig } = get();
    if (!exportConfig) return;

    set({ isExporting: true });
    try {
      // Small delay to let React render the loading state
      await new Promise((resolve) => setTimeout(resolve, 100));
      const configToExport = exportConfig.prepare
        ? await exportConfig.prepare(options)
        : exportConfig;
      await exportToExcel(configToExport);
    } finally {
      set({ isExporting: false });
    }
  },
}));
