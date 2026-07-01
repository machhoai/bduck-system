import { z } from "zod";
import { db } from "../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { logAudit } from "./auditService.js";

const COLLECTION_NAME = "system_configs";
const DOC_ID = "external_count_requirement";

export type ExternalCountRequirementConfig = {
  id: string;
  enabled: boolean;
  require_before_scan: boolean;
  require_before_submit: boolean;
  updated_at?: Date | null;
  updated_by?: string | null;
};

export const updateExternalCountRequirementSchema = z.object({
  enabled: z.boolean(),
  require_before_scan: z.boolean(),
  require_before_submit: z.boolean(),
});

export type UpdateExternalCountRequirementInput = z.infer<
  typeof updateExternalCountRequirementSchema
>;

const configRef = () => db.collection(COLLECTION_NAME).doc(DOC_ID);

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const fromFirestore = (
  data: FirebaseFirestore.DocumentData | undefined,
): ExternalCountRequirementConfig | null => {
  if (!data) return null;

  return {
    id: DOC_ID,
    enabled: data.enabled === true,
    require_before_scan: data.require_before_scan !== false,
    require_before_submit: data.require_before_submit !== false,
    updated_at: toDate(data.updated_at),
    updated_by: data.updated_by ?? null,
  };
};

export const getExternalCountRequirement = async () => {
  const snapshot = await configRef().get();
  const persisted = fromFirestore(snapshot.data());
  if (persisted) return persisted;

  return {
    id: DOC_ID,
    enabled: false,
    require_before_scan: true,
    require_before_submit: true,
    updated_at: null,
    updated_by: null,
  };
};

export const updateExternalCountRequirement = async (
  input: UpdateExternalCountRequirementInput,
  actorId: string,
) => {
  const previous = await getExternalCountRequirement();
  const now = new Date();
  const data = {
    enabled: input.enabled,
    require_before_scan: input.require_before_scan,
    require_before_submit: input.require_before_submit,
    updated_at: now,
    updated_by: actorId,
  };

  await configRef().set(data, { merge: true });
  await logAudit({
    entity_type: "EXTERNAL_COUNT_CONFIG",
    entity_id: DOC_ID,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: previous,
    new_value: { id: DOC_ID, ...data },
  });

  return getExternalCountRequirement();
};
