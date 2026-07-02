import {
  AuditAction,
  type FileTemplate,
  type FileTemplateCategory,
  type FileTemplateVersionEntry,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { fileTemplateRepository } from "../repositories/fileTemplateRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface CreateFileTemplateInput {
  title: string;
  description?: string | null;
  category?: FileTemplateCategory;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: FileTemplate["file_format"];
}

export interface UpdateFileTemplateInput {
  title?: string;
  description?: string | null;
  category?: FileTemplateCategory;
}

export type UploadNewFileTemplateVersionInput = Pick<
  CreateFileTemplateInput,
  "file_name" | "file_url" | "file_size" | "file_format"
>;

type FileTemplateServiceError = Error & {
  statusCode: number;
  messages: Record<string, string>;
};

const createServiceError = (
  statusCode: number,
  vi: string,
  zh: string,
): FileTemplateServiceError =>
  Object.assign(new Error(vi), { statusCode, messages: { vi, zh } });

const getActiveFileTemplate = async (id: string): Promise<FileTemplate> => {
  const template = await fileTemplateRepository.findById(id);
  if (!template || template.is_deleted) {
    throw createServiceError(
      404,
      "Không tìm thấy biểu mẫu.",
      "未找到表单模板。",
    );
  }

  return template;
};

export const fetchFileTemplates = async (): Promise<FileTemplate[]> => {
  return fileTemplateRepository.findActive();
};

export const createFileTemplate = async (
  input: CreateFileTemplateInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<FileTemplate> => {
  const id = randomUUID();
  const template = await fileTemplateRepository.create(id, {
    id,
    title: input.title,
    description: input.description || null,
    category: input.category || "general",
    file_name: input.file_name,
    file_url: input.file_url,
    file_size: input.file_size,
    file_format: input.file_format,
    uploaded_by: userId,
    version: 1,
    version_history: [],
  });

  await logAudit({
    entity_type: "file_templates",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: template as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return template;
};

export const updateFileTemplate = async (
  id: string,
  input: UpdateFileTemplateInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<FileTemplate> => {
  const current = await getActiveFileTemplate(id);
  const updateData: UpdateFileTemplateInput = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) {
    updateData.description = input.description || null;
  }
  if (input.category !== undefined) updateData.category = input.category;

  await fileTemplateRepository.update(id, updateData);
  const updated = {
    ...current,
    ...updateData,
    updated_at: new Date(),
  } as FileTemplate;

  await logAudit({
    entity_type: "file_templates",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: current as unknown as Record<string, unknown>,
    new_value: updated as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return updated;
};

export const deleteFileTemplate = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const current = await getActiveFileTemplate(id);
  await fileTemplateRepository.softDelete(id);

  await logAudit({
    entity_type: "file_templates",
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

export const uploadNewVersion = async (
  id: string,
  input: UploadNewFileTemplateVersionInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<FileTemplate> => {
  const current = await getActiveFileTemplate(id);
  const currentVersion = current.version || 1;
  const previousVersion: FileTemplateVersionEntry = {
    version: currentVersion,
    file_url: current.file_url,
    file_name: current.file_name,
    file_size: current.file_size,
    file_format: current.file_format,
    uploaded_by: current.uploaded_by,
    uploaded_at:
      (current.updated_at as Date | undefined) ||
      (current.created_at as Date | undefined) ||
      new Date(),
  };
  const nextVersion = currentVersion + 1;
  const updateData = {
    file_name: input.file_name,
    file_url: input.file_url,
    file_size: input.file_size,
    file_format: input.file_format,
    uploaded_by: userId,
    version: nextVersion,
    version_history: [...(current.version_history || []), previousVersion],
  };

  await fileTemplateRepository.update(id, updateData);
  const updated = {
    ...current,
    ...updateData,
    updated_at: new Date(),
  } as FileTemplate;

  await logAudit({
    entity_type: "file_templates",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: current as unknown as Record<string, unknown>,
    new_value: updated as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return updated;
};
