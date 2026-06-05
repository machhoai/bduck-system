import { create } from "zustand";
import { exportToExcel, ExportConfig } from "../utils/exportExcel";

interface ExportStore {
  exportConfig: ExportConfig | null;
  isExporting: boolean;
  setExportConfig: (config: ExportConfig | null) => void;
  triggerExport: () => Promise<void>;
}

export const useExportStore = create<ExportStore>((set, get) => ({
  exportConfig: null,
  isExporting: false,
  setExportConfig: (config) => set({ exportConfig: config }),
  triggerExport: async () => {
    const { exportConfig } = get();
    if (!exportConfig) return;

    set({ isExporting: true });
    try {
      // Small delay to let React render the loading state
      await new Promise((resolve) => setTimeout(resolve, 100));
      await exportToExcel(exportConfig);
    } finally {
      set({ isExporting: false });
    }
  },
}));
