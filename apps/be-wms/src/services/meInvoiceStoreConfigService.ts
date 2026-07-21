import {
  AuditAction,
  MeInvoiceSignType,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import type { MeInvoiceStoreConfigInput } from "./meInvoiceConfigSchemas.js";
import { dateFromValue } from "./meInvoiceConfigService.js";
import { loadWarehouseById } from "./warehouseService.js";

export const toPublicStoreConfig = (
  data: Record<string, unknown>,
): MeInvoiceStoreConfig => ({
  ...(data as unknown as MeInvoiceStoreConfig),
  go_live_at: dateFromValue(data.go_live_at),
  invoice_date_source: "PAYMENT_TIME",
  issue_scope: "GO_LIVE_FORWARD",
  default_buyer_name:
    typeof data.default_buyer_name === "string"
      ? data.default_buyer_name
      : "Khách lẻ (Không lấy hóa đơn)",
  default_buyer_address:
    typeof data.default_buyer_address === "string"
      ? data.default_buyer_address
      : "",
  default_buyer_tax_code: null,
  default_payment_method_name:
    typeof data.default_payment_method_name === "string"
      ? data.default_payment_method_name
      : "",
  default_unit_name:
    typeof data.default_unit_name === "string" ? data.default_unit_name : "",
  sku_mapping:
    data.sku_mapping && typeof data.sku_mapping === "object"
      ? (data.sku_mapping as MeInvoiceStoreConfig["sku_mapping"])
      : {},
  category_vat_mapping:
    data.category_vat_mapping && typeof data.category_vat_mapping === "object"
      ? (data.category_vat_mapping as MeInvoiceStoreConfig["category_vat_mapping"])
      : {},
  payment_method_mapping:
    data.payment_method_mapping && typeof data.payment_method_mapping === "object"
      ? (data.payment_method_mapping as MeInvoiceStoreConfig["payment_method_mapping"])
      : {},
  validated_at: dateFromValue(data.validated_at),
  created_at: dateFromValue(data.created_at) ?? new Date(0),
  updated_at: dateFromValue(data.updated_at) ?? new Date(0),
});

export const getMeInvoiceStoreConfig = async (
  warehouseId: string,
  authorization: AuthorizationService,
): Promise<MeInvoiceStoreConfig | null> => {
  authorization.assert("invoices.config", warehouseId);
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  return stored && stored.is_deleted !== true ? toPublicStoreConfig(stored) : null;
};

export const listMeInvoiceStoreAccountOptions = async (
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.config", warehouseId);
  await loadWarehouseById(warehouseId);
  const accounts = await meInvoiceConfigRepository.listAccounts();
  return accounts
    .filter((account) => !account.is_deleted)
    .map((account) => ({
      id: account.id,
      display_name: account.display_name,
      tax_code: account.tax_code,
      environment: account.environment,
      enabled: account.enabled === true,
      last_test_succeeded: account.last_test_succeeded === true,
    }))
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
};

const validationFields = (input: MeInvoiceStoreConfigInput) => ({
  meinvoice_account_id: input.meinvoice_account_id,
  inv_series: input.inv_series,
  invoice_with_code: input.invoice_with_code,
  sign_type: input.sign_type,
  seller_shop_code: input.seller_shop_code,
  seller_shop_name: input.seller_shop_name,
  price_includes_vat: input.price_includes_vat,
  tax_rate_source: input.tax_rate_source,
  default_vat_rate_name: input.default_vat_rate_name,
  sku_mapping: input.sku_mapping,
  category_vat_mapping: input.category_vat_mapping,
  payment_method_mapping: input.payment_method_mapping,
  default_payment_method_name: input.default_payment_method_name,
  default_unit_name: input.default_unit_name,
  go_live_at: input.go_live_at?.toISOString() ?? null,
  default_buyer_name: input.default_buyer_name,
  default_buyer_address: input.default_buyer_address,
  default_buyer_tax_code: input.default_buyer_tax_code,
  option_user_defined: input.option_user_defined,
});

const needsValidation = (
  input: MeInvoiceStoreConfigInput,
  previous: Record<string, unknown> | null,
) => {
  const nextFields = validationFields(input);
  const previousFields = previous
    ? Object.fromEntries(
        Object.keys(nextFields).map((key) => [
          key,
          key === "go_live_at"
            ? dateFromValue(previous[key])?.toISOString() ?? null
            : previous[key],
        ]),
      )
    : null;
  return JSON.stringify(nextFields) !== JSON.stringify(previousFields);
};

export const saveMeInvoiceStoreConfig = async (
  warehouseId: string,
  input: MeInvoiceStoreConfigInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<MeInvoiceStoreConfig> => {
  authorization.assert("invoices.config", warehouseId);
  await loadWarehouseById(warehouseId);
  const account = await meInvoiceConfigRepository.getAccount(input.meinvoice_account_id);
  if (!account || account.is_deleted || (input.enabled && !account.enabled)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Tài khoản meInvoice không tồn tại hoặc chưa được bật.",
        zh: "meInvoice 账户不存在或尚未启用。",
      },
    };
  }

  const previous = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  const requiresRevalidation = needsValidation(input, previous);
  if (
    input.enabled &&
    (requiresRevalidation ||
      !dateFromValue(previous?.validated_at) ||
      previous?.validation_error_code)
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Phải lưu ở trạng thái tắt và xác minh ký hiệu MISA thành công trước khi bật cấu hình cửa hàng.",
        zh: "启用门店配置前，必须先以禁用状态保存并成功验证 MISA 发票系列。",
      },
    };
  }

  const now = new Date();
  const payload: Record<string, unknown> = {
    id: warehouseId,
    warehouse_id: warehouseId,
    ...input,
    invoice_date_source: "PAYMENT_TIME",
    issue_scope: "GO_LIVE_FORWARD",
    is_invoice_calculating_machine:
      input.sign_type === MeInvoiceSignType.CALCULATING_MACHINE,
    validated_at: requiresRevalidation ? null : previous?.validated_at ?? null,
    validation_error_code: requiresRevalidation
      ? null
      : previous?.validation_error_code ?? null,
    updated_by: actorId,
    updated_at: now,
    action_time: input.action_time ?? now,
    sync_time: now,
    is_deleted: false,
  };
  if (!previous) Object.assign(payload, { created_by: actorId, created_at: now });

  await meInvoiceConfigRepository.setStoreConfig(warehouseId, payload);
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!stored) throw new Error("Unable to reload saved meInvoice store config.");
  const current = toPublicStoreConfig(stored);

  await logAudit({
    entity_type: "MEINVOICE_STORE_CONFIG",
    entity_id: warehouseId,
    warehouse_id: warehouseId,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: previous
      ? (toPublicStoreConfig(previous) as unknown as Record<string, unknown>)
      : null,
    new_value: current as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return current;
};

export const markMeInvoiceStoreConfigValidated = async (
  warehouseId: string,
  errorCode: string | null,
): Promise<void> => {
  const now = new Date();
  await meInvoiceConfigRepository.setStoreConfig(warehouseId, {
    validated_at: now,
    validation_error_code: errorCode,
    updated_at: now,
  });
};
