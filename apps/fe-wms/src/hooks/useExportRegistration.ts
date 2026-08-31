import { useEffect } from "react";

import { useExportStore } from "../stores/useExportStore";
import type { RegisteredExportConfig } from "../utils/exportExcel";

export function useExportRegistration(config: RegisteredExportConfig | null) {
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
