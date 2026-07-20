import {
  AuditAction,
  MeInvoiceEnvironment,
  type MeInvoiceAccount,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { AuthorizationService } from "./authorization/index.js";
import type { AuditMetadata } from "./auditService.js";
import { logAudit } from "./auditService.js";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import { MEINVOICE_BASE_URLS } from "./meInvoiceClient.js";
import { createMeInvoiceCredentialCrypto } from "./meInvoiceCredentialCrypto.js";
import type { MeInvoiceAccountInput } from "./meInvoiceConfigSchemas.js";

const dateFromValue = (value: unknown): Date | null => {
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

const assertSystemAdmin = (authorization: AuthorizationService) => {
  if (!authorization.context.isSystemAdmin) {
    throw {
      statusCode: 403,
      messages: {
        vi: "Chỉ quản trị viên hệ thống được quản lý tài khoản MISA meInvoice.",
        zh: "只有系统管理员可以管理 MISA meInvoice 账户。",
      },
    };
  }
};

export const toPublicMeInvoiceAccount = (
  data: StoredMeInvoiceAccount,
): MeInvoiceAccount => ({
  id: data.id,
  legal_entity_id: data.legal_entity_id,
  display_name: data.display_name,
  tax_code: data.tax_code,
  environment: data.environment as MeInvoiceEnvironment,
  base_url: data.base_url,
  enabled: data.enabled === true,
  has_client_id: Boolean(data.client_id),
  has_client_secret: Boolean(data.client_secret),
  has_username: Boolean(data.username),
  has_password: Boolean(data.password),
  last_tested_at: dateFromValue(data.last_tested_at),
  last_test_succeeded: data.last_test_succeeded ?? null,
  last_test_error_code: data.last_test_error_code ?? null,
  last_template_sync_at: dateFromValue(data.last_template_sync_at),
  created_by: data.created_by,
  updated_by: data.updated_by,
  is_deleted: data.is_deleted === true,
  created_at: dateFromValue(data.created_at) ?? new Date(0),
  updated_at: dateFromValue(data.updated_at) ?? new Date(0),
});

const credentialContext = (accountId: string, field: string) =>
  `account:${accountId}:${field}`;

export const listMeInvoiceAccounts = async (
  authorization: AuthorizationService,
): Promise<MeInvoiceAccount[]> => {
  assertSystemAdmin(authorization);
  const accounts = await meInvoiceConfigRepository.listAccounts();
  return accounts
    .map(toPublicMeInvoiceAccount)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
};

export const saveMeInvoiceAccount = async (
  accountId: string | null,
  input: MeInvoiceAccountInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<MeInvoiceAccount> => {
  assertSystemAdmin(authorization);
  const id = accountId ?? randomUUID();
  const previousStored = accountId
    ? await meInvoiceConfigRepository.getAccount(accountId)
    : null;
  if (accountId && (!previousStored || previousStored.is_deleted)) {
    throw {
      statusCode: 404,
      messages: { vi: "Không tìm thấy tài khoản meInvoice.", zh: "未找到 meInvoice 账户。" },
    };
  }
  if (
    !previousStored &&
    (!input.client_id || !input.client_secret || !input.username || !input.password)
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Tài khoản mới phải có ClientID, ClientSecret, tên đăng nhập và mật khẩu.",
        zh: "新账户必须包含 ClientID、ClientSecret、用户名和密码。",
      },
    };
  }

  const now = new Date();
  const crypto = createMeInvoiceCredentialCrypto();
  const credentialsChanged = Boolean(
    input.client_id || input.client_secret || input.username || input.password,
  );
  const environmentChanged = previousStored?.environment !== input.environment;
  const identityChanged = previousStored?.tax_code !== input.tax_code;
  if (
    input.enabled &&
    (!previousStored?.last_test_succeeded ||
      credentialsChanged ||
      environmentChanged ||
      identityChanged)
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Phải test token và tải mẫu thành công sau lần thay đổi credential gần nhất trước khi bật tài khoản.",
        zh: "启用账户前，必须在最近一次凭据变更后成功测试令牌并加载模板。",
      },
    };
  }
  const credentialRevision =
    Number((previousStored as (StoredMeInvoiceAccount & { credential_revision?: number }) | null)?.credential_revision ?? 0) +
    (credentialsChanged || environmentChanged || identityChanged ? 1 : 0);
  const payload: Record<string, unknown> = {
    id,
    legal_entity_id: input.legal_entity_id,
    display_name: input.display_name,
    tax_code: input.tax_code,
    environment: input.environment,
    base_url: MEINVOICE_BASE_URLS[input.environment],
    enabled: input.enabled,
    credential_revision: credentialRevision,
    updated_by: actorId,
    updated_at: now,
    action_time: input.action_time ?? now,
    sync_time: now,
    is_deleted: false,
  };
  if (!previousStored) Object.assign(payload, { created_by: actorId, created_at: now });
  if (input.client_id) {
    payload.client_id = crypto.encrypt(
      input.client_id,
      credentialContext(id, "client_id"),
    );
  }
  if (input.client_secret) {
    payload.client_secret = crypto.encrypt(
      input.client_secret,
      credentialContext(id, "client_secret"),
    );
  }
  if (input.username) payload.username = crypto.encrypt(input.username, credentialContext(id, "username"));
  if (input.password) payload.password = crypto.encrypt(input.password, credentialContext(id, "password"));
  if (credentialsChanged || environmentChanged || identityChanged) {
    Object.assign(payload, {
      last_tested_at: null,
      last_test_succeeded: null,
      last_test_error_code: null,
      last_template_sync_at: null,
    });
  }

  await meInvoiceConfigRepository.setAccount(id, payload);
  const currentStored = await meInvoiceConfigRepository.getAccount(id);
  if (!currentStored) throw new Error("Unable to reload saved meInvoice account.");
  const current = toPublicMeInvoiceAccount(currentStored);
  const previous = previousStored ? toPublicMeInvoiceAccount(previousStored) : null;

  await logAudit({
    entity_type: "MEINVOICE_ACCOUNT",
    entity_id: id,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: previous as unknown as Record<string, unknown> | null,
    new_value: current as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return current;
};

export { dateFromValue, credentialContext };
