"use client";

export type DataInvalidationKey =
  | "all"
  | "audit_logs"
  | "attendance_late_reports"
  | "attendance_logs"
  | "employee_profiles"
  | "file_templates"
  | "import_vouchers"
  | "inventory"
  | "nonconformity_reports"
  | "quarantine_records"
  | "in_app_notifications"
  | "notification_dispatches"
  | "organizations"
  | "office_scope_configs"
  | "office_scope_ceilings"
  | "office_scope_edges"
  | "office_scope_materializations"
  | "pending_approvals"
  | "process_configs"
  | "product_bom"
  | "product_categories"
  | "products"
  | "roles"
  | "stock_count_items"
  | "stock_count_sessions"
  | "user_warehouse_roles"
  | "user_access"
  | "users"
  | "warehouse_locations"
  | "warehouse_location_slots"
  | "warehouse_location_slot_products"
  | "warehouse_attendance_exemptions"
  | "warehouse_attendance_policies"
  | "warehouses"
  | "inventory_stock_policies"
  | "workflow_definitions"
  | "workflow_tasks";

const DATA_MUTATION_EVENT = "bduck:data-mutated";

type DataMutationDetail = {
  keys: DataInvalidationKey[];
};

function normalizeKeys(
  keys: DataInvalidationKey | DataInvalidationKey[],
): DataInvalidationKey[] {
  return Array.isArray(keys) ? keys : [keys];
}

export function emitDataMutation(
  keys: DataInvalidationKey | DataInvalidationKey[],
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<DataMutationDetail>(DATA_MUTATION_EVENT, {
      detail: { keys: normalizeKeys(keys) },
    }),
  );
}

export function subscribeDataMutation(
  keys: DataInvalidationKey | DataInvalidationKey[],
  callback: () => void,
) {
  if (typeof window === "undefined") return () => {};

  const watchedKeys = new Set(normalizeKeys(keys));
  const handleMutation = (event: Event) => {
    const emittedKeys =
      (event as CustomEvent<DataMutationDetail>).detail?.keys || [];

    if (
      emittedKeys.includes("all") ||
      emittedKeys.some((key) => watchedKeys.has(key))
    ) {
      callback();
    }
  };

  window.addEventListener(DATA_MUTATION_EVENT, handleMutation);

  return () => {
    window.removeEventListener(DATA_MUTATION_EVENT, handleMutation);
  };
}
