import {
  type ExternalStoreBinding,
  type ExternalStoreSourceSystem,
} from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { db } from "../config/firebase.js";

import {
  canonicalizeWarehouseIdsWithBindings,
  canonicalWarehouseForBinding,
} from "./externalStoreBindingPolicy.js";

const COLLECTION = "external_store_bindings";

const bindingSchema = z.object({
  id: z.string().trim().min(1).max(200),
  source_system: z.literal("JOYWORLD_LEGACY"),
  source_account_key: z.string().trim().min(1).max(200),
  mode: z.literal("CONSOLIDATED"),
  canonical_warehouse_id: z.string().trim().min(1).max(200),
  member_warehouse_ids: z.array(z.string().trim().min(1).max(200)).min(1),
  display_name: z.string().trim().min(1).max(300),
  enabled: z.boolean(),
  created_at: z.unknown().optional(),
  updated_at: z.unknown().optional(),
  updated_by: z.string().nullable().optional(),
}).superRefine((value, context) => {
  if (!value.member_warehouse_ids.includes(value.canonical_warehouse_id)) {
    context.addIssue({
      code: "custom",
      path: ["member_warehouse_ids"],
      message: "member_warehouse_ids must contain canonical_warehouse_id",
    });
  }
  if (new Set(value.member_warehouse_ids).size !== value.member_warehouse_ids.length) {
    context.addIssue({
      code: "custom",
      path: ["member_warehouse_ids"],
      message: "member_warehouse_ids must not contain duplicates",
    });
  }
});

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const toBinding = (id: string, value: unknown): ExternalStoreBinding => {
  const parsed = bindingSchema.parse({
    ...(value && typeof value === "object" ? value : {}),
    id,
  });
  return {
    ...parsed,
    member_warehouse_ids: [...parsed.member_warehouse_ids],
    created_at: toDate(parsed.created_at),
    updated_at: toDate(parsed.updated_at),
  };
};

export const listExternalStoreBindings = async (
  sourceSystem?: ExternalStoreSourceSystem,
): Promise<ExternalStoreBinding[]> => {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs
    .map((document) => toBinding(document.id, document.data()))
    .filter(
      (binding) =>
        binding.enabled && (!sourceSystem || binding.source_system === sourceSystem),
    );
};

export const resolveExternalStoreBinding = async (
  sourceSystem: ExternalStoreSourceSystem,
  warehouseId: string,
): Promise<ExternalStoreBinding | null> => {
  const bindings = await listExternalStoreBindings(sourceSystem);
  const matches = bindings.filter((binding) =>
    binding.member_warehouse_ids.includes(warehouseId),
  );
  if (matches.length > 1) {
    throw new Error(`EXTERNAL_STORE_BINDING_AMBIGUOUS:${sourceSystem}:${warehouseId}`);
  }
  return matches[0] ?? null;
};

export const resolveCanonicalExternalWarehouseId = async (
  sourceSystem: ExternalStoreSourceSystem,
  warehouseId: string,
): Promise<string> =>
  canonicalWarehouseForBinding(
    await resolveExternalStoreBinding(sourceSystem, warehouseId),
    warehouseId,
  );

export const canonicalizeExternalWarehouseIds = async (
  sourceSystem: ExternalStoreSourceSystem,
  warehouseIds: readonly string[],
): Promise<string[]> => {
  const bindings = await listExternalStoreBindings(sourceSystem);
  return canonicalizeWarehouseIdsWithBindings(bindings, warehouseIds);
};

export const upsertExternalStoreBinding = async (
  value: Omit<ExternalStoreBinding, "created_at" | "updated_at">,
): Promise<ExternalStoreBinding> => {
  const parsed = bindingSchema.parse(value);
  const reference = db.collection(COLLECTION).doc(parsed.id);
  const existing = await reference.get();
  await reference.set(
    {
      ...parsed,
      member_warehouse_ids: [...parsed.member_warehouse_ids],
      updated_at: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  const stored = await reference.get();
  return toBinding(stored.id, stored.data());
};
