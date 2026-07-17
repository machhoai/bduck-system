import { useCallback } from "react";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { callWarehouseApi } from "./warehouseHookApi";

export function useWarehouseLocationMutations() {
  const createLocation = useCallback(async (payload: unknown) => {
    const result = await callWarehouseApi("/api/locations", "POST", payload);
    emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
    return result;
  }, []);

  const updateLocation = useCallback(async (id: string, payload: unknown) => {
    const result = await callWarehouseApi(
      `/api/locations/${id}`,
      "PUT",
      payload,
    );
    emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
    return result;
  }, []);

  const deleteLocation = useCallback(async (id: string) => {
    const result = await callWarehouseApi(`/api/locations/${id}`, "DELETE");
    emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
    return result;
  }, []);

  return { createLocation, updateLocation, deleteLocation };
}
