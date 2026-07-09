import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { z } from "zod";
import { AuditAction, type OpenApiWarehouseConfig } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { logAudit } from "./auditService.js";

const COLLECTION_NAME = "openapi_warehouse_configs";
const DEFAULT_API_VERSION = "10.11.8";
const DEFAULT_ACTION_VERSIONS: Record<string, string> = {
  report_revenue_summary: "10.11.8",
  report_sell_statistics_bygoodstype: "10.11.8",
  setmeal_getsellgoods: "11.7.1",
  setmeal_passticket_list: "11.7.1",
  oversea_subscribe_base_list: "11.7.1",
  oversea_goodsmanage_list: "11.7.1",
  gift_type: "10.11.8",
  gift_realtime_stock: "10.11.8",
  member_getmember_membercode: "10.11.8",
  member_getmember_serialnumber: "10.11.8",
  order_precalculate: "11.7.1",
  order_create: "11.7.1",
  order_pay: "11.7.1",
  order_pay_query: "11.7.1",
};

type StoredOpenApiConfig = {
  warehouse_id: string;
  app_id: string;
  base_url: string;
  api_version: string;
  action_versions?: Record<string, string>;
  enabled: boolean;
  secret_key_ciphertext?: string | null;
  secret_key_iv?: string | null;
  secret_key_tag?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
  updated_by?: string | null;
};

export type ResolvedOpenApiConfig = OpenApiWarehouseConfig & {
  secret_key: string;
};

export const updateOpenApiConfigSchema = z.object({
  app_id: z.string().trim().min(1).max(200),
  secret_key: z.string().trim().min(1).max(500).optional(),
  base_url: z.string().trim().min(1).max(500).transform((value, ctx) => {
    const normalized = normalizeBaseUrl(value);
    try {
      new URL(normalized);
      return normalized;
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid URL",
      });
      return z.NEVER;
    }
  }),
  api_version: z.string().trim().min(1).max(50).default(DEFAULT_API_VERSION),
  action_versions: z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(50)).default(DEFAULT_ACTION_VERSIONS),
  enabled: z.boolean().default(true),
});

export type UpdateOpenApiConfigInput = z.infer<
  typeof updateOpenApiConfigSchema
>;

const configRef = (warehouseId: string) =>
  db.collection(COLLECTION_NAME).doc(warehouseId);

const dateFromValue = (value: unknown): Date | null => {
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

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const getDefaultOpenApiActionVersions = () => ({
  ...DEFAULT_ACTION_VERSIONS,
});

const getEncryptionKey = () => {
  const raw = process.env.OPENAPI_CONFIG_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("OPENAPI_CONFIG_ENCRYPTION_KEY is required.");
  return createHash("sha256").update(raw).digest();
};

const encryptSecret = (secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret.trim(), "utf8"),
    cipher.final(),
  ]);
  return {
    secret_key_ciphertext: ciphertext.toString("base64"),
    secret_key_iv: iv.toString("base64"),
    secret_key_tag: cipher.getAuthTag().toString("base64"),
  };
};

const decryptSecret = (data: StoredOpenApiConfig): string => {
  if (!data.secret_key_ciphertext || !data.secret_key_iv || !data.secret_key_tag) {
    throw new Error("OpenAPI SecretKey is not configured.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(data.secret_key_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(data.secret_key_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data.secret_key_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

const toPublicConfig = (
  id: string,
  data: StoredOpenApiConfig,
): OpenApiWarehouseConfig => {
  const hasSecret = Boolean(data.secret_key_ciphertext);
  return {
    id,
    warehouse_id: data.warehouse_id,
    app_id: data.app_id,
    base_url: data.base_url,
    api_version: data.api_version || DEFAULT_API_VERSION,
    action_versions: {
      ...DEFAULT_ACTION_VERSIONS,
      ...(data.action_versions ?? {}),
    },
    enabled: data.enabled === true,
    has_secret: hasSecret,
    secret_key_mask: hasSecret ? "********" : null,
    created_at: dateFromValue(data.created_at),
    updated_at: dateFromValue(data.updated_at),
    updated_by: data.updated_by ?? null,
  };
};

export const getOpenApiConfig = async (
  warehouseId: string,
): Promise<OpenApiWarehouseConfig | null> => {
  const snapshot = await configRef(warehouseId).get();
  if (!snapshot.exists) return null;
  return toPublicConfig(snapshot.id, snapshot.data() as StoredOpenApiConfig);
};

export const listOpenApiConfigs = async (): Promise<OpenApiWarehouseConfig[]> => {
  const snapshot = await db.collection(COLLECTION_NAME).get();
  return snapshot.docs
    .map((doc) => toPublicConfig(doc.id, doc.data() as StoredOpenApiConfig))
    .sort((a, b) => a.warehouse_id.localeCompare(b.warehouse_id));
};

export const resolveOpenApiConfig = async (
  warehouseId: string,
): Promise<ResolvedOpenApiConfig> => {
  const snapshot = await configRef(warehouseId).get();
  if (!snapshot.exists) {
    throw new Error(`OpenAPI config not found for warehouse ${warehouseId}.`);
  }

  const data = snapshot.data() as StoredOpenApiConfig;
  if (data.enabled !== true) {
    throw new Error(`OpenAPI config is disabled for warehouse ${warehouseId}.`);
  }

  return {
    ...toPublicConfig(snapshot.id, data),
    secret_key: decryptSecret(data),
  };
};

export const hasEnabledOpenApiConfig = async (warehouseId: string) => {
  try {
    const config = await getOpenApiConfig(warehouseId);
    return config?.enabled === true && config.has_secret;
  } catch {
    return false;
  }
};

export const upsertOpenApiConfig = async (
  warehouseId: string,
  input: UpdateOpenApiConfigInput,
  actorId: string,
): Promise<OpenApiWarehouseConfig> => {
  const parsed = updateOpenApiConfigSchema.parse(input);
  const previous = await getOpenApiConfig(warehouseId);
  const now = new Date();
  const payload: Record<string, unknown> = {
    warehouse_id: warehouseId,
    app_id: parsed.app_id.trim(),
    base_url: parsed.base_url,
    api_version: parsed.api_version.trim(),
    action_versions: {
      ...DEFAULT_ACTION_VERSIONS,
      ...parsed.action_versions,
    },
    enabled: parsed.enabled,
    updated_at: now,
    updated_by: actorId,
  };

  if (!previous) payload.created_at = now;
  if (parsed.secret_key) Object.assign(payload, encryptSecret(parsed.secret_key));

  await configRef(warehouseId).set(payload, { merge: true });
  const current = await getOpenApiConfig(warehouseId);
  if (!current) throw new Error("Failed to load saved OpenAPI config.");

  await logAudit({
    entity_type: "OPENAPI_CONFIG",
    entity_id: warehouseId,
    warehouse_id: warehouseId,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: previous as unknown as Record<string, unknown> | null,
    new_value: current as unknown as Record<string, unknown>,
  });

  return current;
};
