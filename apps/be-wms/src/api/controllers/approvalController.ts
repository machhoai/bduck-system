/**
 * Approval Controller — REST endpoints for approval actions
 *
 * GET  /pending              — List pending approvals for current user
 * GET  /:entityType/:entityId — Approval timeline for a specific entity
 * POST /:id/approve          — Approve a record
 * POST /:id/reject           — Reject a record
 *
 * ARCHITECTURE: Controller → Service → Repository (layered)
 * All routes require authentication (requireAuth middleware).
 */

import type { Request, Response, NextFunction } from "express";
import * as approvalService from "../../services/approvalService.js";

/**
 * GET /api/approvals/pending
 * Returns pending approvals for the current user's roles.
 * Replaces the old workflow tasks collectionGroup query.
 */
export async function getPendingApprovals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = (req as any).user;

    const records = await approvalService.getPendingTasksForUser({
      id: user?.id || user?.uid || "UNKNOWN",
      roleIds: user?.roleIds || [],
      roleAssignments: user?.roleAssignments || [],
    });

    res.json({
      success: true,
      data: records,
      messages: {
        vi: `Tìm thấy ${records.length} phiếu chờ duyệt.`,
        zh: `找到 ${records.length} 个待审批单据。`,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/approvals/:entityType/:entityId
 * Returns the full approval timeline for a voucher/order.
 */
export async function getApprovalTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;

    const records = await approvalService.getApprovalTimeline(
      entityType as any,
      entityId,
    );

    res.json({
      success: true,
      data: records,
      messages: {
        vi: "Đã tải timeline phê duyệt.",
        zh: "已加载审批时间线。",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/approvals/:id/approve
 * Approve a specific approval record.
 *
 * Body: { comments?: string }
 */
export async function approveHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const approvalId = req.params.id as string;
    const authUser = (req as any).user;
    const userId = authUser?.id;
    const { comments, otp } = req.body ?? {};

    if (!userId) {
      res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: "Không xác định được người dùng.",
          zh: "无法识别用户。",
        },
      });
      return;
    }

    const result = await approvalService.approveLevel(
      approvalId,
      userId,
      comments,
      otp,
      {
        id: userId,
        roleIds: authUser?.roleIds || [],
        roleAssignments: authUser?.roleAssignments || [],
      },
    );

    res.json({
      success: true,
      data: {
        allApproved: result.allApproved,
        levelCompleted: result.levelCompleted,
      },
      messages: {
        vi: result.allApproved
          ? "Tất cả cấp phê duyệt đã hoàn thành."
          : "Đã phê duyệt thành công.",
        zh: result.allApproved
          ? "所有审批级别已完成。"
          : "审批成功。",
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || { vi: error.message, zh: error.message },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/approvals/:id/reject
 * Reject a specific approval record.
 *
 * Body: { reason: string }
 */
export async function rejectHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const approvalId = req.params.id as string;
    const authUser = (req as any).user;
    const userId = authUser?.id;
    const { reason, otp } = req.body ?? {};

    if (!userId) {
      res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: "Không xác định được người dùng.",
          zh: "无法识别用户。",
        },
      });
      return;
    }

    await approvalService.rejectApproval(approvalId, userId, reason, otp, {
      id: userId,
      roleIds: authUser?.roleIds || [],
      roleAssignments: authUser?.roleAssignments || [],
    });

    res.json({
      success: true,
      data: null,
      messages: {
        vi: "Đã từ chối phê duyệt.",
        zh: "已拒绝审批。",
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || { vi: error.message, zh: error.message },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/approvals/:entityType/:entityId/cancel
 * Cancel all pending approvals for an entity (creator only).
 *
 * Body: { reason?: string }
 */
export async function cancelHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const userId = (req as any).user?.id;
    const { reason, otp } = req.body ?? {};

    if (!userId) {
      res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: "Không xác định được người dùng.",
          zh: "无法识别用户。",
        },
      });
      return;
    }

    await approvalService.cancelByCreator(
      entityType as any,
      entityId,
      userId,
      reason,
      otp,
    );

    res.json({
      success: true,
      data: null,
      messages: {
        vi: "Đã hủy lệnh thành công.",
        zh: "已成功撤销单据。",
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || { vi: error.message, zh: error.message },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/approvals/:entityType/:entityId/force-cancel
 * Force-cancel a voucher at any status (privileged users only).
 *
 * Requires permission: vouchers.force_cancel
 * Body: { reason: string } (mandatory)
 */
export async function forceCancelHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const userId = (req as any).user?.id;
    const userPermissions = (req as any).user?.permissions ?? {};
    const { reason } = req.body ?? {};

    if (!userId) {
      res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: "Không xác định được người dùng.",
          zh: "无法识别用户。",
        },
      });
      return;
    }

    // ── Permission check: vouchers.force_cancel ──
    const hasForceCancel = (() => {
      const globalPerms = userPermissions["global"] || {};
      if (globalPerms["*"] === true) return true;
      if (globalPerms["vouchers.force_cancel"] === true) return true;
      // Check warehouse-scoped permissions
      return Object.entries(userPermissions).some(
        ([scope, perms]: [string, any]) => {
          if (scope === "global") return false;
          return perms["*"] === true || perms["vouchers.force_cancel"] === true;
        },
      );
    })();

    if (!hasForceCancel) {
      res.status(403).json({
        success: false,
        data: null,
        messages: {
          vi: "Bạn không có quyền hủy lệnh đặc biệt.",
          zh: "您没有强制撤销权限。",
        },
      });
      return;
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Lý do hủy là bắt buộc.",
          zh: "撤销原因为必填项。",
        },
      });
      return;
    }

    await approvalService.forceCancel(
      entityType as any,
      entityId,
      userId,
      reason,
    );

    res.json({
      success: true,
      data: null,
      messages: {
        vi: "Đã hủy lệnh thành công (quyền đặc biệt).",
        zh: "已成功强制撤销单据。",
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || { vi: error.message, zh: error.message },
      });
      return;
    }
    next(error);
  }
}
