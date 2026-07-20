import { AuditAction, type MeInvoiceTemplate } from "@bduck/shared-types";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { MeInvoiceApiError, MeInvoiceClient } from "./meInvoiceClient.js";
import { createMeInvoiceCredentialCrypto } from "./meInvoiceCredentialCrypto.js";
import {
  credentialContext,
  dateFromValue,
} from "./meInvoiceConfigService.js";
import {
  markMeInvoiceStoreConfigValidated,
  toPublicStoreConfig,
} from "./meInvoiceStoreConfigService.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const refreshFlights = new Map<string, Promise<string>>();

interface ResolvedMeInvoiceAccount {
  stored: StoredMeInvoiceAccount & { credential_revision?: number };
  client: MeInvoiceClient;
  credentials: {
    clientSecret: string;
    taxCode: string;
    username: string;
    password: string;
  };
}

const resolveAccount = async (
  accountId: string,
  requireEnabled: boolean,
): Promise<ResolvedMeInvoiceAccount> => {
  const stored = await meInvoiceConfigRepository.getAccount(accountId);
  if (!stored || stored.is_deleted || (requireEnabled && !stored.enabled)) {
    throw new Error("MISA meInvoice account is unavailable.");
  }
  if (!stored.client_id || !stored.client_secret || !stored.username || !stored.password) {
    throw new Error("MISA meInvoice account credentials are incomplete.");
  }

  const crypto = createMeInvoiceCredentialCrypto();
  const clientId = crypto.decrypt(
    stored.client_id,
    credentialContext(accountId, "client_id"),
  );
  return {
    stored,
    client: new MeInvoiceClient(stored.base_url, clientId),
    credentials: {
      clientSecret: crypto.decrypt(
        stored.client_secret,
        credentialContext(accountId, "client_secret"),
      ),
      taxCode: stored.tax_code,
      username: crypto.decrypt(stored.username, credentialContext(accountId, "username")),
      password: crypto.decrypt(stored.password, credentialContext(accountId, "password")),
    },
  };
};

const getCachedToken = async (
  account: ResolvedMeInvoiceAccount,
): Promise<string | null> => {
  const cached = await meInvoiceConfigRepository.getToken(account.stored.id);
  if (!cached) return null;
  const refreshAfter = dateFromValue(cached.refresh_after);
  const revision = Number(account.stored.credential_revision ?? 0);
  if (!refreshAfter || refreshAfter.getTime() <= Date.now()) return null;
  if (cached.credential_revision !== revision) return null;

  return createMeInvoiceCredentialCrypto().decrypt(
    cached.token,
    `token:${account.stored.id}`,
  );
};

const refreshToken = async (account: ResolvedMeInvoiceAccount): Promise<string> => {
  const token = await account.client.getToken(account.credentials);
  const now = new Date();
  await meInvoiceConfigRepository.setToken(account.stored.id, {
    account_id: account.stored.id,
    token: createMeInvoiceCredentialCrypto().encrypt(
      token,
      `token:${account.stored.id}`,
    ),
    credential_revision: Number(account.stored.credential_revision ?? 0),
    refresh_after: new Date(now.getTime() + 7 * DAY_MS),
    expires_at: new Date(now.getTime() + 14 * DAY_MS),
    updated_at: now,
  });
  return token;
};

const getAccessToken = async (
  account: ResolvedMeInvoiceAccount,
  forceRefresh = false,
): Promise<string> => {
  if (!forceRefresh) {
    const cached = await getCachedToken(account);
    if (cached) return cached;
  }

  const existing = refreshFlights.get(account.stored.id);
  if (existing) return existing;
  const flight = refreshToken(account).finally(() => {
    refreshFlights.delete(account.stored.id);
  });
  refreshFlights.set(account.stored.id, flight);
  return flight;
};

export const executeWithMeInvoiceClient = async <T>(
  accountId: string,
  operation: (client: MeInvoiceClient, token: string) => Promise<T>,
): Promise<T> => {
  const account = await resolveAccount(accountId, true);
  const token = await getAccessToken(account);
  try {
    return await operation(account.client, token);
  } catch (error) {
    if (error instanceof MeInvoiceApiError && error.httpStatus === 401) {
      const refreshedToken = await getAccessToken(account, true);
      return operation(account.client, refreshedToken);
    }
    throw error;
  }
};

const loadTemplates = async (
  account: ResolvedMeInvoiceAccount,
  forceTokenRefresh = false,
): Promise<MeInvoiceTemplate[]> => {
  const token = await getAccessToken(account, forceTokenRefresh);
  const [withCode, withoutCode] = await Promise.all([
    account.client.listTemplates(token, true),
    account.client.listTemplates(token, false),
  ]);
  const unique = new Map<string, MeInvoiceTemplate>();
  for (const template of [...withCode, ...withoutCode]) {
    unique.set(`${template.inv_series}:${template.ip_template_id}`, template);
  }
  return [...unique.values()].sort((a, b) => a.inv_series.localeCompare(b.inv_series));
};

export const testMeInvoiceAccount = async (
  accountId: string,
  authorization: AuthorizationService,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<{ templates: MeInvoiceTemplate[]; tested_at: Date }> => {
  if (!authorization.context.isSystemAdmin) {
    throw new Error("System administrator permission is required.");
  }
  const existingAccount = await meInvoiceConfigRepository.getAccount(accountId);
  if (!existingAccount || existingAccount.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy tài khoản MISA meInvoice.",
        zh: "未找到 MISA meInvoice 账户。",
      },
    };
  }
  const testedAt = new Date();
  try {
    const account = await resolveAccount(accountId, false);
    const templates = await loadTemplates(account, true);
    await meInvoiceConfigRepository.setAccount(accountId, {
      last_tested_at: testedAt,
      last_test_succeeded: true,
      last_test_error_code: null,
      last_template_sync_at: testedAt,
      updated_at: testedAt,
    });
    await logAudit({
      entity_type: "MEINVOICE_ACCOUNT",
      entity_id: accountId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        connection_test: "SUCCESS",
        template_count: templates.length,
        tested_at: testedAt,
      },
      notes: "MISA meInvoice connection test",
      ...auditMetadata,
    });
    return { templates, tested_at: testedAt };
  } catch (error) {
    const errorCode =
      error instanceof MeInvoiceApiError ? error.code : "CONNECTION_TEST_FAILED";
    await meInvoiceConfigRepository.setAccount(accountId, {
      last_tested_at: testedAt,
      last_test_succeeded: false,
      last_test_error_code: errorCode,
      updated_at: testedAt,
    });
    await logAudit({
      entity_type: "MEINVOICE_ACCOUNT",
      entity_id: accountId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        connection_test: "FAILED",
        error_code: errorCode,
        tested_at: testedAt,
      },
      notes: "MISA meInvoice connection test",
      ...auditMetadata,
    });
    throw error;
  }
};

export const validateMeInvoiceStoreConfig = async (
  warehouseId: string,
  authorization: AuthorizationService,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<{ template: MeInvoiceTemplate; validated_at: Date }> => {
  authorization.assert("invoices.config", warehouseId);
  const storedConfig = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!storedConfig || storedConfig.is_deleted === true) {
    throw new Error("MISA meInvoice store config does not exist.");
  }
  const config = toPublicStoreConfig(storedConfig);

  try {
    const account = await resolveAccount(config.meinvoice_account_id, true);
    const token = await getAccessToken(account);
    const templates = await account.client.listTemplates(
      token,
      config.invoice_with_code,
    );
    const template = templates.find(
      (item) => item.inv_series === config.inv_series && !item.inactive,
    );
    if (!template) {
      throw new MeInvoiceApiError(
        "Configured invoice series is not active on MISA meInvoice.",
        "INVOICE_SERIES_NOT_ACTIVE",
        400,
      );
    }

    await markMeInvoiceStoreConfigValidated(warehouseId, null);
    await logAudit({
      entity_type: "MEINVOICE_STORE_CONFIG",
      entity_id: warehouseId,
      warehouse_id: warehouseId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        validation: "SUCCESS",
        inv_series: config.inv_series,
        template_id: template.ip_template_id,
      },
      notes: "MISA meInvoice store config validation",
      ...auditMetadata,
    });
    return { template, validated_at: new Date() };
  } catch (error) {
    const errorCode =
      error instanceof MeInvoiceApiError ? error.code : "VALIDATION_FAILED";
    await markMeInvoiceStoreConfigValidated(
      warehouseId,
      errorCode,
    );
    await logAudit({
      entity_type: "MEINVOICE_STORE_CONFIG",
      entity_id: warehouseId,
      warehouse_id: warehouseId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        validation: "FAILED",
        inv_series: config.inv_series,
        error_code: errorCode,
      },
      notes: "MISA meInvoice store config validation",
      ...auditMetadata,
    });
    throw error;
  }
};
