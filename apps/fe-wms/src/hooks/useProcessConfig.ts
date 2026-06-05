import { useEffect, useState } from "react";
import type { ProcessConfig, ProcessEntityType } from "@bduck/shared-types";
import { fetchConfigByEntityType } from "./useApprovalApi";
import { subscribeDataMutation } from "@/lib/dataInvalidation";

export function useProcessConfig(entityType: ProcessEntityType, warehouseId?: string) {
  const [config, setConfig] = useState<ProcessConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isDisposed = false;
    const load = async () => {
      try {
        const data = await fetchConfigByEntityType(entityType, warehouseId);
        if (!isDisposed) setConfig(data as ProcessConfig);
      } catch (err) {
        console.error("Failed to load process config:", err);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };
    
    setLoading(true);
    void load();

    const unsub = subscribeDataMutation("process_configs", () => {
        void load();
    });

    return () => {
      isDisposed = true;
      unsub();
    };
  }, [entityType, warehouseId]);

  return { config, loading };
}
