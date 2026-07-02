import { AuditAction, type FileTemplate } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { fileTemplateRepository } from "../repositories/fileTemplateRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface CreateFileTemplateInput {
  title: string;
  description?: string | null;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: FileTemplate["file_format"];
}

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
    file_name: input.file_name,
    file_url: input.file_url,
    file_size: input.file_size,
    file_format: input.file_format,
    uploaded_by: userId,
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
