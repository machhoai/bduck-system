/**
 * Process Config Routes
 *
 * All routes require authentication + workflows.manage permission.
 * GET    /                  — List all configs
 * GET    /:entityType       — Get config for entity type
 * PUT    /:id               — Update config
 * POST   /seed/:entityType  — Seed default config
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import {
  getAllConfigsHandler,
  getConfigHandler,
  updateConfigHandler,
  seedConfigHandler,
  reseedConfigHandler,
} from "../controllers/processConfigController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { getRequestAuthorization } from "../middlewares/requestAccessContext.js";
import { requireSystemAdmin } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

const CONFIG_READ_PERMISSIONS: Record<string, string[]> = {
  IMPORT_VOUCHER: ["workflows.manage", "vouchers.read", "vouchers.write"],
  EXPORT_VOUCHER: ["workflows.manage", "vouchers.read", "vouchers.write"],
  EXTERNAL_QUEUE_EXPORT: [
    "workflows.manage",
    "external_scan.view",
    "external_scan.approve",
    "external_scan.manage_queue",
  ],
  TRANSFER_ORDER: [
    "workflows.manage",
    "transfers.read",
    "transfers.write",
    "transfers.receive",
  ],
  TRANSFER_INTRA: [
    "workflows.manage",
    "transfers.read",
    "transfers.write",
    "transfers.receive",
  ],
};

function requireConfigReadAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = getRequestAuthorization(req);
  if (!authorization) {
    return res.status(403).json({
      success: false,
      data: null,
      messages: {
        vi: "Không có quyền truy cập.",
        zh: "没有访问权限。",
      },
    });
  }

  const rawEntityType = req.params.entityType;
  const entityType = Array.isArray(rawEntityType)
    ? rawEntityType[0]
    : rawEntityType;
  const allowedActions = CONFIG_READ_PERMISSIONS[entityType] ?? [
    "workflows.manage",
  ];

  const hasPermission =
    authorization.context.isSystemAdmin ||
    allowedActions.some(
      (action) => authorization.facilityIdsFor(action).length > 0,
    );

  if (hasPermission) {
    return next();
  }

  return res.status(403).json({
    success: false,
    data: null,
    messages: {
      vi: "Bạn không có quyền tải cấu hình quy trình này.",
      zh: "您没有加载此流程配置的权限。",
    },
  });
}

router.get("/", requireSystemAdmin, getAllConfigsHandler);
router.get("/:entityType", requireConfigReadAccess, getConfigHandler);
router.put("/:id", requireSystemAdmin, updateConfigHandler);
router.post("/seed/:entityType", requireSystemAdmin, seedConfigHandler);
router.post("/reseed/:entityType", requireSystemAdmin, reseedConfigHandler);

export default router;
