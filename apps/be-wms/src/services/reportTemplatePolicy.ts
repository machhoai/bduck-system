import type {
  ReportTemplate,
  ReportTemplateVisibility,
} from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";

export const REPORT_XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const assertReportXlsxFile = (
  fileName: string,
  buffer: Buffer,
): void => {
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
};

export const createReportTimestamps = () => {
  const now = new Date();
  return {
    created_at: now,
    updated_at: now,
    action_time: now,
    sync_time: now,
    is_deleted: false,
  };
};

export const canAccessReportTemplate = (
  template: ReportTemplate,
  userId: string,
): boolean => template.owner_id === userId || template.visibility === "shared";

export const assertReportShareAllowed = (
  visibility: ReportTemplateVisibility,
  authorization: AuthorizationService,
): void => {
  if (visibility !== "shared") return;
  if (
    authorization.context.isSystemAdmin ||
    authorization.facilityIdsFor("reports.templates.share").length > 0
  ) {
    return;
  }
  throw {
    statusCode: 403,
    messages: {
      vi: "Bạn không có quyền chia sẻ mẫu báo cáo.",
      zh: "您无权共享报表模板。",
    },
  };
};
