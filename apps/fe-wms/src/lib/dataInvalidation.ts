"use client";

export type DataInvalidationKey =
  | "all"
  | "audit_logs"
  | "import_vouchers"
  | "inventory"
  | "organizations"
  | "pending_approvals"
  | "process_configs"
  | "product_bom"
  | "product_categories"
  | "products"
  | "roles"
  | "user_warehouse_roles"
  | "users"
  | "warehouse_locations"
  | "warehouses"
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
