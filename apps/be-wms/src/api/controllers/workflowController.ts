/**
 * Workflow Controller — REST handlers for the Workflow module.
 *
 * Endpoints:
 *   GET    /api/workflows                        → List all definitions
 *   GET    /api/workflows/:id                    → Get definition by ID
 *   POST   /api/workflows                        → Create new definition
 *   PUT    /api/workflows/:id                    → Update definition metadata
 *   DELETE /api/workflows/:id                    → Archive (soft delete)
 *   POST   /api/workflows/:id/versions           → Save DAG as new version
 *   GET    /api/workflows/:id/versions           → List versions
 *   POST   /api/workflows/:id/versions/:vid/publish → Publish version
 *   POST   /api/workflows/engine/start            → Start workflow instance
 *   POST   /api/workflows/engine/complete-task    → Complete a pending task
 *   POST   /api/workflows/engine/timer-callback   → Timer fires (Cloud Tasks)
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  createWorkflowDefinitionSchema,
  updateWorkflowDefinitionSchema,
  saveWorkflowVersionSchema,
  idParamSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import * as defService from "../../services/workflowDefinitionService.js";
import * as engineService from "../../services/workflowEngineService.js";

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const getRequestUserId = (req: Request): string =>
  (req as any).user?.id || "unknown";

const handleWorkflowError = (res: Response, error: unknown) => {
  console.error("[workflowController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu đầu vào không hợp lệ.", zh: "输入数据无效。" },
      400,
      error.flatten(),
    );
  }

  const apiErr = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  if (apiErr.statusCode && apiErr.messages) {
    return sendError(res, apiErr.messages, apiErr.statusCode);
  }

  return sendError(
    res,
    { vi: "Lỗi hệ thống khi xử lý quy trình.", zh: "处理流程时系统错误。" },
    500,
  );
};

// ─────────────────────────────────────────────
// DEFINITION CRUD
// ─────────────────────────────────────────────

export const getWorkflowsHandler = async (req: Request, res: Response) => {
  try {
    const definitions = await defService.fetchWorkflowDefinitions();
    return sendSuccess(res, definitions, {
      vi: "Lấy danh sách quy trình thành công.",
      zh: "成功获取流程列表。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const getWorkflowByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const definition = await defService.fetchWorkflowDefinitionById(id);
    if (!definition || definition.is_deleted) {
      return sendError(
        res,
        { vi: "Quy trình không tồn tại.", zh: "流程不存在。" },
        404,
      );
    }

    // Include latest version (nodes + edges) if available
    let latestVersion = null;
    if (definition.current_version_id) {
      const version = await defService.fetchVersionById(id, definition.current_version_id);
      if (version) {
        latestVersion = version;
      }
    }

    // Fallback: if no published version, try the most recent draft
    if (!latestVersion) {
      const versions = await defService.fetchVersionsByDefinition(id);
      if (versions.length > 0) {
        latestVersion = versions[0]; // Already sorted desc by version_number
      }
    }

    return sendSuccess(res, { ...definition, latest_version: latestVersion }, {
      vi: "Lấy quy trình thành công.",
      zh: "成功获取流程。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const createWorkflowHandler = async (req: Request, res: Response) => {
  try {
    const data = createWorkflowDefinitionSchema.parse(req.body);
    const definition = await defService.createWorkflowDefinition(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      definition,
      { vi: "Tạo quy trình thành công.", zh: "成功创建流程。" },
      201,
    );
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const updateWorkflowHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateWorkflowDefinitionSchema.parse(req.body);
    await defService.updateWorkflowDefinition(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Cập nhật quy trình thành công.",
      zh: "成功更新流程。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const archiveWorkflowHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await defService.archiveWorkflowDefinition(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Lưu trữ quy trình thành công.",
      zh: "成功归档流程。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

// ─────────────────────────────────────────────
// VERSIONS
// ─────────────────────────────────────────────

export const saveVersionHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const dag = saveWorkflowVersionSchema.parse(req.body);
    const version = await defService.saveWorkflowDag(
      id,
      dag,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      version,
      { vi: "Lưu phiên bản DAG thành công.", zh: "成功保存 DAG 版本。" },
      201,
    );
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const getVersionsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const versions = await defService.fetchVersionsByDefinition(id);
    return sendSuccess(res, versions, {
      vi: "Lấy danh sách phiên bản thành công.",
      zh: "成功获取版本列表。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

export const publishVersionHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const vidSchema = z.object({ vid: z.string().uuid() });
    const { vid } = vidSchema.parse(req.params);
    await defService.publishWorkflowVersion(
      id,
      vid,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Xuất bản quy trình thành công.",
      zh: "成功发布流程。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

// ─────────────────────────────────────────────
// ENGINE (start, complete, timer)
// ─────────────────────────────────────────────

const startWorkflowSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  warehouse_id: z.string().uuid().nullable().optional(),
  entity_payload: z.record(z.string(), z.unknown()).optional(),
});

export const startWorkflowHandler = async (req: Request, res: Response) => {
  try {
    const { entity_type, entity_id, warehouse_id, entity_payload } =
      startWorkflowSchema.parse(req.body);
    const instance = await engineService.startWorkflow(
      entity_type,
      entity_id,
      warehouse_id || null,
      getRequestUserId(req),
      entity_payload || {},
    );
    return sendSuccess(
      res,
      instance,
      { vi: "Khởi tạo quy trình thành công.", zh: "成功启动流程。" },
      201,
    );
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

const completeTaskSchema = z.object({
  instance_id: z.string().uuid(),
  task_id: z.string().uuid(),
  result: z.record(z.string(), z.unknown()).optional(),
});

export const completeTaskHandler = async (req: Request, res: Response) => {
  try {
    const { instance_id, task_id, result } =
      completeTaskSchema.parse(req.body);
    await engineService.completeTask(
      instance_id,
      task_id,
      getRequestUserId(req),
      result || {},
    );
    return sendSuccess(res, null, {
      vi: "Hoàn thành task thành công.",
      zh: "成功完成任务。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};

const timerCallbackSchema = z.object({
  instance_id: z.string().uuid(),
  task_id: z.string().uuid(),
});

export const timerCallbackHandler = async (req: Request, res: Response) => {
  try {
    const { instance_id, task_id } =
      timerCallbackSchema.parse(req.body);
    await engineService.advanceFromTimer(instance_id, task_id);
    return sendSuccess(res, null, {
      vi: "Timer callback xử lý thành công.",
      zh: "定时器回调处理成功。",
    });
  } catch (error) {
    return handleWorkflowError(res, error);
  }
};
