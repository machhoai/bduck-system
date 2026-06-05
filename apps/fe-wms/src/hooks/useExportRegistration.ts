import { useEffect } from "react";
import { useExportStore } from "../stores/useExportStore";
import { ExportConfig } from "../utils/exportExcel";

export function useExportRegistration(config: ExportConfig | null) {
  const setExportConfig = useExportStore((s) => s.setExportConfig);

  useEffect(() => {
    if (config) {
      setExportConfig(config);
    } else {
      setExportConfig(null);
    }

    return () => {
      setExportConfig(null);
    };
  }, [config, setExportConfig]);
}
