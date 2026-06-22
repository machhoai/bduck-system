import { randomUUID } from "crypto";
import { AuditAction, type ReportExcelMapping } from "@bduck/shared-types";
import type {
  ReportExportRecord,
  ReportTemplate,
  ReportTemplateVisibility,
  ReportTemplateVersion,
} from "@bduck/shared-types";
import * as reportRepo from "../repositories/reportRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  applyExcelMapping,
  extractWorkbookMeta,
  loadWorkbookFromBuffer,
} from "./reportWorkbookService.js";
import {
  buildExportStoragePath,
  buildTemplateStoragePath,
  readReportFile,
  saveReportFile,
} from "./reportStorageService.js";
import {
  resolveReportFieldInstances,
} from "./reportFieldResolver.js";
import type { RequestUserContext } from "./warehouseAccess.js";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function assertXlsxFile(fileName: string, buffer: Buffer) {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Chỉ hỗ trợ file Excel .xlsx.",
        zh: "仅支持 .xlsx Excel 文件。",
      },
    };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    throw {
      statusCode: 400,
      messages: {
        vi: "File Excel không được vượt quá 10MB.",
        zh: "Excel 文件不能超过 10MB。",
      },
    };
  }
}

function nowStamped() {
  const now = new Date();
  return {
    created_at: now,
    updated_at: now,
    action_time: now,
    sync_time: now,
    is_deleted: false,
  };
}

function canAccessTemplate(template: ReportTemplate, userId: string) {
  return template.owner_id === userId || template.visibility === "shared";
}

function assertShareAllowed(
  visibility: ReportTemplateVisibility,
  user: RequestUserContext,
) {
  if (visibility !== "shared") return;
  const globalPerms = user.permissions?.global || {};
  if (globalPerms["*"] === true || globalPerms["reports.templates.share"] === true) {
    return;
  }
  throw {
    statusCode: 403,
    messages: {
      vi: "Bạn không có quyền chia sẻ mẫu báo cáo.",
      zh: "您无权共享报表模板。",
    },
  };
}

export async function listReportTemplates(user: RequestUserContext) {
  return reportRepo.findVisibleTemplates(user.id);
}

export async function createExcelReportTemplate(
  input: {
    name: string;
    original_file_name: string;
    file_base64: string;
    visibility: ReportTemplateVisibility;
    mapping: ReportExcelMapping;
  },
  user: RequestUserContext,
  auditMetadata?: AuditMetadata,
) {
  assertShareAllowed(input.visibility, user);

  const fileBuffer = Buffer.from(input.file_base64, "base64");
  assertXlsxFile(input.original_file_name, fileBuffer);
  const workbook = await loadWorkbookFromBuffer(fileBuffer);
  const workbookMeta = extractWorkbookMeta(workbook);

  const templateId = randomUUID();
  const versionId = randomUUID();
  const storagePath = buildTemplateStoragePath(
    templateId,
    versionId,
    input.original_file_name,
  );
  await saveReportFile(storagePath, fileBuffer, XLSX_CONTENT_TYPE);

  const template: ReportTemplate = {
    id: templateId,
    name: input.name,
    type: "EXCEL",
    visibility: input.visibility,
    owner_id: user.id,
    active_version_id: versionId,
    status: "active",
    ...nowStamped(),
  };
  const version: ReportTemplateVersion = {
    id: versionId,
    template_id: templateId,
    version: 1,
    original_file_name: input.original_file_name,
    storage_path: storagePath,
    workbook_meta: workbookMeta,
    mapping: input.mapping,
    status: "active",
    created_by: user.id,
    ...nowStamped(),
  };

  await reportRepo.createTemplate(template);
  await reportRepo.createVersion(version);
  await logAudit({
    entity_type: "report_templates",
    entity_id: templateId,
    action: AuditAction.CREATE,
    user_id: user.id,
    old_value: null,
    new_value: template as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return { template, version };
}

export async function updateExcelReportTemplate(
  templateId: string,
  input: {
    name?: string;
    visibility?: ReportTemplateVisibility;
    mapping?: ReportExcelMapping;
  },
  user: RequestUserContext,
  auditMetadata?: AuditMetadata,
) {
  const template = await getOwnedTemplate(templateId, user.id);
  if (input.visibility) assertShareAllowed(input.visibility, user);
  const activeVersion = await getActiveVersion(template);

  if (input.mapping) {
    await reportRepo.updateVersion(activeVersion.id, { mapping: input.mapping });
  }
  await reportRepo.updateTemplate(template.id, {
    name: input.name ?? template.name,
    visibility: input.visibility ?? template.visibility,
  });

  await logAudit({
    entity_type: "report_templates",
    entity_id: template.id,
    action: AuditAction.UPDATE,
    user_id: user.id,
    old_value: template as unknown as Record<string, unknown>,
    new_value: input as Record<string, unknown>,
    ...auditMetadata,
  });

  return getReportTemplateDetail(template.id, user);
}

export async function getReportTemplateDetail(
  templateId: string,
  user: RequestUserContext,
) {
  const template = await getAccessibleTemplate(templateId, user.id);
  const version = await getActiveVersion(template);
  return { template, version };
}

export async function readTemplateWorkbookFile(
  templateId: string,
  user: RequestUserContext,
) {
  const { version } = await getReportTemplateDetail(templateId, user);
  return {
    fileName: version.original_file_name,
    buffer: await readReportFile(version.storage_path),
  };
}

async function getOwnedTemplate(templateId: string, userId: string) {
  const template = await reportRepo.findTemplateById(templateId);
  if (!template || template.owner_id !== userId) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy mẫu báo cáo thuộc quyền sở hữu của bạn.",
        zh: "未找到您拥有的报表模板。",
      },
    };
  }
  return template;
}

async function getAccessibleTemplate(templateId: string, userId: string) {
  const template = await reportRepo.findTemplateById(templateId);
  if (!template || !canAccessTemplate(template, userId)) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy mẫu báo cáo.",
        zh: "未找到报表模板。",
      },
    };
  }
  return template;
}

async function getActiveVersion(template: ReportTemplate) {
  if (!template.active_version_id) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Mẫu báo cáo chưa có phiên bản Excel đang hoạt động.",
        zh: "报表模板尚无可用的 Excel 版本。",
      },
    };
  }
  const version = await reportRepo.findVersionById(template.active_version_id);
  if (!version) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy phiên bản mẫu báo cáo.",
        zh: "未找到报表模板版本。",
      },
    };
  }
  return version;
}

export async function previewExcelReport(
  templateId: string,
  mappingOverride: ReportExcelMapping | undefined,
  user: RequestUserContext,
) {
  const { version } = await getReportTemplateDetail(templateId, user);
  const mapping = mappingOverride ?? version.mapping;
  const resolved = await resolveReportFieldInstances(mapping.field_instances, user);
  return mapping.cell_mappings.map((cellMapping) => ({
    ...cellMapping,
    value: resolved.get(cellMapping.field_instance_id) ?? null,
  }));
}

export async function exportExcelReport(
  templateId: string,
  mappingOverride: ReportExcelMapping | undefined,
  user: RequestUserContext,
  auditMetadata?: AuditMetadata,
) {
  const { template, version } = await getReportTemplateDetail(templateId, user);
  const mapping = mappingOverride ?? version.mapping;
  const resolved = await resolveReportFieldInstances(mapping.field_instances, user);
  const templateBuffer = await readReportFile(version.storage_path);
  const workbook = await loadWorkbookFromBuffer(templateBuffer);
  applyExcelMapping(workbook, mapping, resolved);
  const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const exportId = randomUUID();
  const outputFileName = `${template.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
  const storagePath = buildExportStoragePath(exportId, outputFileName);
  await saveReportFile(storagePath, outputBuffer, XLSX_CONTENT_TYPE);

  const record: ReportExportRecord = {
    id: exportId,
    template_id: template.id,
    template_version_id: version.id,
    requested_by: user.id,
    status: "done",
    output_file_name: outputFileName,
    storage_path: storagePath,
    error_message: null,
    ...nowStamped(),
  };
  await reportRepo.createExportRecord(record);
  await logAudit({
    entity_type: "report_exports",
    entity_id: exportId,
    action: AuditAction.EXPORT,
    user_id: user.id,
    old_value: null,
    new_value: record as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return { record, buffer: outputBuffer };
}
