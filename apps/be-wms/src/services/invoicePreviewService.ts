import { AuditAction } from "@bduck/shared-types";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { executeWithMeInvoiceClient } from "./meInvoiceConnectionService.js";
import { buildMeInvoicePayload } from "./meInvoicePayloadBuilder.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";

const PREVIEW_TTL_MS = 5 * 60 * 1000;

export const previewInvoiceSourceOrder = async (
  sourceOrderDocumentId: string,
  warehouseId: string,
  expectedSourcePayloadHash: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.review", warehouseId);
  const sourceOrder = await invoiceOrderRepository.getOrder(
    sourceOrderDocumentId,
    warehouseId,
  );
  if (!sourceOrder) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy đơn hàng đã đồng bộ.",
        zh: "找不到已同步的订单。",
      },
    };
  }
  if (sourceOrder.source_payload_hash !== expectedSourcePayloadHash) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Dữ liệu đơn hàng đã thay đổi. Vui lòng tải lại trước khi xem hóa đơn.",
        zh: "订单数据已更改，请重新加载后再预览发票。",
      },
    };
  }
  const preflight = sourceOrder.preflight as
    | { issue_eligible?: boolean; issues?: unknown[] }
    | undefined;
  if (preflight?.issue_eligible !== true) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Đơn hàng chưa vượt qua kiểm tra trước khi tạo bản xem trước.",
        zh: "订单尚未通过预览前检查。",
      },
      data: { issues: preflight?.issues ?? [] },
    };
  }

  const storedConfig =
    await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (
    !storedConfig ||
    storedConfig.is_deleted === true ||
    storedConfig.enabled !== true ||
    !storedConfig.validated_at ||
    storedConfig.validation_error_code
  ) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Cấu hình hóa đơn cửa hàng chưa được bật và xác minh.",
        zh: "门店发票配置尚未启用并验证。",
      },
    };
  }
  const storeConfig = toPublicStoreConfig(storedConfig);
  const account = await meInvoiceConfigRepository.getAccount(
    storeConfig.meinvoice_account_id,
  );
  if (!account || account.is_deleted || !account.enabled) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Tài khoản meInvoice chưa sẵn sàng.",
        zh: "meInvoice 账户尚未就绪。",
      },
    };
  }

  const built = buildMeInvoicePayload(sourceOrder, storeConfig, account);
  const url = await executeWithMeInvoiceClient(account.id, (client, token) =>
    client.previewInvoice(token, built.payload),
  );
  const createdAt = new Date();
  const result = {
    url,
    expires_at: new Date(createdAt.getTime() + PREVIEW_TTL_MS),
    ref_id: built.ref_id,
    prepared_payload_hash: built.prepared_payload_hash,
    source_payload_hash: expectedSourcePayloadHash,
  };
  await logAudit({
    entity_type: "INVOICE_SOURCE_ORDER",
    entity_id: sourceOrderDocumentId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: null,
    new_value: {
      preview: "CREATED",
      ref_id: built.ref_id,
      prepared_payload_hash: built.prepared_payload_hash,
      source_payload_hash: expectedSourcePayloadHash,
      expires_at: result.expires_at,
    },
    notes: "MISA meInvoice unpublish preview",
    ...auditMetadata,
  });
  return result;
};

export const previewInvoiceDocument = async (
  documentId: string,
  warehouseId: string,
  expectedRevision: number,
  expectedSourcePayloadHash: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.review", warehouseId);
  const document = await invoiceDocumentRepository.getDocument(
    documentId,
    warehouseId,
  );
  if (!document) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy bản nháp hóa đơn.",
        zh: "找不到发票草稿。",
      },
    };
  }
  if (
    document.revision !== expectedRevision ||
    document.source_payload_hash !== expectedSourcePayloadHash
  ) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Bản nháp đã thay đổi. Vui lòng tải lại trước khi xem hóa đơn.",
        zh: "发票草稿已更改，请重新加载后再预览。",
      },
    };
  }
  if (document.issue_eligible !== true || !document.calculation) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Bản nháp còn lỗi validation nên chưa thể xem trước.",
        zh: "草稿仍有验证错误，无法预览。",
      },
      data: { issues: document.validation_issues ?? [] },
    };
  }

  const storedConfig =
    await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (
    !storedConfig ||
    storedConfig.is_deleted === true ||
    storedConfig.enabled !== true ||
    !storedConfig.validated_at ||
    storedConfig.validation_error_code
  ) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Cấu hình hóa đơn cửa hàng chưa được bật và xác minh.",
        zh: "门店发票配置尚未启用并验证。",
      },
    };
  }
  const storeConfig = toPublicStoreConfig(storedConfig);
  const account = await meInvoiceConfigRepository.getAccount(
    storeConfig.meinvoice_account_id,
  );
  if (!account || account.is_deleted || !account.enabled) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Tài khoản meInvoice chưa sẵn sàng.",
        zh: "meInvoice 账户尚未就绪。",
      },
    };
  }

  const built = buildMeInvoicePayload(document, storeConfig, account);
  const url = await executeWithMeInvoiceClient(account.id, (client, token) =>
    client.previewInvoice(token, built.payload),
  );
  const createdAt = new Date();
  await invoiceDocumentRepository.recordPreparedPayload(
    documentId,
    warehouseId,
    expectedRevision,
    expectedSourcePayloadHash,
    {
      ref_id: built.ref_id,
      prepared_payload_hash: built.prepared_payload_hash,
      updated_by: actorId,
      updated_at: createdAt,
    },
  );
  const result = {
    url,
    expires_at: new Date(createdAt.getTime() + PREVIEW_TTL_MS),
    ref_id: built.ref_id,
    prepared_payload_hash: built.prepared_payload_hash,
    source_payload_hash: expectedSourcePayloadHash,
    revision: expectedRevision,
  };
  await logAudit({
    entity_type: "INVOICE_DOCUMENT",
    entity_id: documentId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: null,
    new_value: {
      preview: "CREATED",
      revision: expectedRevision,
      ref_id: built.ref_id,
      prepared_payload_hash: built.prepared_payload_hash,
      source_payload_hash: expectedSourcePayloadHash,
      expires_at: result.expires_at,
    },
    notes: "MISA meInvoice draft revision preview",
    ...auditMetadata,
  });
  return result;
};
