import type { ExternalStoreBinding } from "@bduck/shared-types";

export interface ExternalOrderPartitionCandidate<T> {
  value: T;
  linkedWarehouseId: string | null;
}

export const canonicalWarehouseForBinding = (
  binding: ExternalStoreBinding | null,
  warehouseId: string,
): string => binding?.canonical_warehouse_id ?? warehouseId;

export const canonicalizeWarehouseIdsWithBindings = (
  bindings: readonly ExternalStoreBinding[],
  warehouseIds: readonly string[],
): string[] => [
  ...new Set(
    warehouseIds.map((warehouseId) => {
      const binding = bindings.find((candidate) =>
        candidate.member_warehouse_ids.includes(warehouseId),
      );
      return canonicalWarehouseForBinding(binding ?? null, warehouseId);
    }),
  ),
];

export const partitionExternalOrders = <T>(input: {
  canonicalWarehouseId: string;
  memberWarehouseIds: readonly string[];
  candidates: readonly ExternalOrderPartitionCandidate<T>[];
}): Map<string, T[]> => {
  const members = new Set(input.memberWarehouseIds);
  const result = new Map<string, T[]>();
  for (const candidate of input.candidates) {
    const warehouseId =
      candidate.linkedWarehouseId && members.has(candidate.linkedWarehouseId)
        ? candidate.linkedWarehouseId
        : input.canonicalWarehouseId;
    result.set(warehouseId, [...(result.get(warehouseId) ?? []), candidate.value]);
  }
  return result;
};
