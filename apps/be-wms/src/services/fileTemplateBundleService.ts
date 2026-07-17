import { AuditAction, type FileTemplateBundle } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { fileTemplateBundleRepository } from "../repositories/fileTemplateBundleRepository.js";
import { fileTemplateRepository } from "../repositories/fileTemplateRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface SaveFileTemplateBundleInput {
  name: string;
  description?: string | null;
  template_ids: string[];
}

type ServiceError = Error & {
  statusCode: number;
  messages: Record<string, string>;
};

const serviceError = (statusCode: number, vi: string, zh: string) =>
  Object.assign(new Error(vi), {
    statusCode,
    messages: { vi, zh },
  }) as ServiceError;

const getActiveBundle = async (id: string) => {
  const bundle = await fileTemplateBundleRepository.findById(id);
  if (!bundle || bundle.is_deleted) {
    throw serviceError(
      404,
      "Không tìm thấy bộ biểu mẫu.",
      "未找到表单模板包。",
    );
  }
  return bundle;
};

const validateTemplates = async (templateIds: string[]) => {
  const uniqueIds = [...new Set(templateIds)];
  const templates = await Promise.all(
    uniqueIds.map((id) => fileTemplateRepository.findById(id)),
  );
  if (templates.some((template) => !template || template.is_deleted)) {
    throw serviceError(
      400,
      "Bộ biểu mẫu chứa biểu mẫu không tồn tại hoặc đã bị xóa.",
      "模板包包含不存在或已删除的表单模板。",
    );
  }
  return uniqueIds;
};

export const fetchFileTemplateBundles = () =>
  fileTemplateBundleRepository.findActive();

export const createFileTemplateBundle = async (
  input: SaveFileTemplateBundleInput,
  userId: string,
  auditMetadata?: AuditMetadata,
) => {
  const templateIds = await validateTemplates(input.template_ids);
  const id = randomUUID();
  const bundle = await fileTemplateBundleRepository.create(id, {
    id,
    name: input.name,
    description: input.description || null,
    template_ids: templateIds,
    created_by: userId,
  });
  await logAudit({
    entity_type: "file_template_bundles",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: bundle as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return bundle;
};

export const updateFileTemplateBundle = async (
  id: string,
  input: Partial<SaveFileTemplateBundleInput>,
  userId: string,
  auditMetadata?: AuditMetadata,
) => {
  const current = await getActiveBundle(id);
  const updateData: Partial<SaveFileTemplateBundleInput> = { ...input };
  if (input.description !== undefined) {
    updateData.description = input.description || null;
  }
  if (input.template_ids) {
    updateData.template_ids = await validateTemplates(input.template_ids);
  }
  await fileTemplateBundleRepository.update(id, updateData);
  const updated = {
    ...current,
    ...updateData,
    updated_at: new Date(),
  } as FileTemplateBundle;
  await logAudit({
    entity_type: "file_template_bundles",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: current as unknown as Record<string, unknown>,
    new_value: updated as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return updated;
};

export const deleteFileTemplateBundle = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
) => {
  const current = await getActiveBundle(id);
  await fileTemplateBundleRepository.softDelete(id);
  await logAudit({
    entity_type: "file_template_bundles",
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
