import {
  AuditAction,
  type ProcessDocument,
  type ProcessDocumentType,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { processDocumentRepository } from "../repositories/processDocumentRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface CreateProcessDocumentInput {
  title: string;
  description?: string | null;
  process_type: ProcessDocumentType;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: "pdf";
}

const getActiveDocument = async (id: string) => {
  const document = await processDocumentRepository.findById(id);
  if (!document || document.is_deleted) {
    throw Object.assign(new Error("Không tìm thấy tài liệu quy trình."), {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy tài liệu quy trình.",
        zh: "未找到流程文档。",
      },
    });
  }
  return document;
};

export const fetchProcessDocuments = () =>
  processDocumentRepository.findActive();

export const createProcessDocument = async (
  input: CreateProcessDocumentInput,
  userId: string,
  auditMetadata?: AuditMetadata,
) => {
  const id = randomUUID();
  const document = await processDocumentRepository.create(id, {
    id,
    title: input.title,
    description: input.description || null,
    process_type: input.process_type,
    file_name: input.file_name,
    file_url: input.file_url,
    file_size: input.file_size,
    file_format: "pdf",
    uploaded_by: userId,
  });
  await logAudit({
    entity_type: "process_documents",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: document as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return document;
};

export const deleteProcessDocument = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
) => {
  const current = await getActiveDocument(id);
  await processDocumentRepository.softDelete(id);
  await logAudit({
    entity_type: "process_documents",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: current as unknown as Record<string, unknown>,
    new_value: { ...current, is_deleted: true } as unknown as Record<
      string,
      unknown
    >,
    ...auditMetadata,
  });
};
