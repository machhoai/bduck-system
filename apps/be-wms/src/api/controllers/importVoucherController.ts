/**
 * Import Voucher Controller — Thin HTTP layer
 *
 * LUẬT THÉP:
 * - Zod validates req.body/query BEFORE service logic
 * - Dual-language error/success messages (vi + zh)
 * - JWT auth is enforced at the route level via requireAuth middleware
 *
 * Endpoints:
 *   GET    /api/import-vouchers            → List (filtered, RBAC-scoped)
 *   GET    /api/import-vouchers/:id        → Detail (items + attachments)
 *   GET    /api/import-vouchers/:id/timeline → Audit + workflow timeline
 *   POST   /api/import-vouchers            → Create + trigger workflow
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  createImportVoucher,
  createImportVoucherSchema,
} from "../../services/importVoucherService.js";
import {
  fetchImportVouchers,
  fetchImportVoucherById,
  fetchImportVoucherTimeline,
} from "../../services/importVoucherQueryService.js";
import { sendSuccess, sendError } from "../../utils/responseHelper.js";

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const getRequestUserId = (req: Request): string =>
  (req as any).user?.id || "unknown";

const getRequestPermissions = (
  req: Request,
): Record<string, Record<string, unknown>> =>
  (req as any).user?.permissions || {};

// ─────────────────────────────────────────────
// GET /api/import-vouchers — List with filters
// ─────────────────────────────────────────────

const listFiltersSchema = z.object({
  status: z.string().optional(),
  creator_id: z.string().optional(),
  approver_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  voucher_number: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const getImportVouchersHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const filters = listFiltersSchema.parse(req.query);
    const userId = getRequestUserId(req);
    const permissions = getRequestPermissions(req);

    const vouchers = await fetchImportVouchers(filters, userId, permissions);

    sendSuccess(res, vouchers, {
      vi: "Lấy danh sách phiếu nhập kho thành công.",
      zh: "成功获取入库单列表。",
    });
  } catch (error) {
    console.error("[importVoucherController] List error:", error);
    sendError(
      res,
      { vi: "Lỗi khi tải danh sách phiếu nhập.", zh: "加载入库单列表出错。" },
      500,
    );
  }
};

// ─────────────────────────────────────────────
// GET /api/import-vouchers/:id — Detail
// ─────────────────────────────────────────────

export const getImportVoucherByIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = getRequestUserId(req);
    const permissions = getRequestPermissions(req);

    const detail = await fetchImportVoucherById(id, userId, permissions);

    if (!detail) {
      sendError(
        res,
        {
          vi: "Phiếu nhập kho không tồn tại hoặc bạn không có quyền xem.",
          zh: "入库单不存在或您无权查看。",
        },
        404,
      );
      return;
    }

    sendSuccess(res, detail, {
      vi: "Lấy chi tiết phiếu nhập kho thành công.",
      zh: "成功获取入库单详情。",
    });
  } catch (error) {
    console.error("[importVoucherController] Detail error:", error);
    sendError(
      res,
      { vi: "Lỗi khi tải chi tiết phiếu nhập.", zh: "加载入库单详情出错。" },
      500,
    );
  }
};

// ─────────────────────────────────────────────
// GET /api/import-vouchers/:id/timeline
// ─────────────────────────────────────────────

export const getImportVoucherTimelineHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const timeline = await fetchImportVoucherTimeline(id);

    sendSuccess(res, timeline, {
      vi: "Lấy lịch sử xử lý phiếu nhập thành công.",
      zh: "成功获取入库单处理历史。",
    });
  } catch (error) {
    console.error("[importVoucherController] Timeline error:", error);
    sendError(
      res,
      { vi: "Lỗi khi tải lịch sử xử lý.", zh: "加载处理历史出错。" },
      500,
    );
  }
};

// ─────────────────────────────────────────────
// POST /api/import-vouchers — Create
// ─────────────────────────────────────────────

export const createImportVoucherHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getRequestUserId(req);

    if (userId === "unknown") {
      res.status(401).json({
        success: false,
        data: null,
        messages: {
          vi: "Chưa xác thực. Vui lòng đăng nhập.",
          zh: "未认证，请登录。",
        },
      });
      return;
    }

    // ── Zod validation ──
    const parsed = createImportVoucherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: `Dữ liệu không hợp lệ: ${parsed.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
          zh: `数据无效: ${parsed.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
        },
      });
      return;
    }

    // ── Service call ──
    const voucher = await createImportVoucher(parsed.data, userId);

    res.status(201).json({
      success: true,
      data: voucher,
      messages: {
        vi: "Phiếu nhập kho đã được tạo thành công.",
        zh: "入库单已成功创建。",
      },
    });
  } catch (error: unknown) {
    const err = error as {
      statusCode?: number;
      messages?: { vi: string; zh: string };
    };

    console.error("[importVoucherController] Create error:", error);

    res.status(err.statusCode || 500).json({
      success: false,
      data: null,
      messages: err.messages || {
        vi: "Đã xảy ra lỗi khi tạo phiếu nhập kho.",
        zh: "创建入库单时发生错误。",
      },
    });
  }
};
