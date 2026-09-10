import { create } from "zustand";

import type {
  ExportRequestOptions,
  RegisteredExportConfig,
} from "../utils/exportExcel";
import { isCustomExportConfig } from "../utils/exportExcel";

interface ExportStore {
  exportConfig: RegisteredExportConfig | null;
  isExporting: boolean;
  setExportConfig: (config: RegisteredExportConfig | null) => void;
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
      if (isCustomExportConfig(exportConfig)) {
        await exportConfig.execute(options);
        return;
      }
      const configToExport = exportConfig.prepare
        ? await exportConfig.prepare(options)
        : exportConfig;
      const { exportToExcel } = await import("../utils/exportExcel");
      await exportToExcel(configToExport);
    } finally {
      set({ isExporting: false });
    }
  },
}));
