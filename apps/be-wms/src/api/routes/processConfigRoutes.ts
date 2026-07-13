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
import { requirePermission } from "../middlewares/rbacMiddleware.js";

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
  const user = (req as any).user;
  const permissions = user?.permissions as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!permissions) {
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

  const hasPermission = Object.values(permissions).some(
    (scopedPermissions) =>
      scopedPermissions["*"] === true ||
      allowedActions.some((action: string) => scopedPermissions[action] === true),
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

router.get("/", requirePermission("workflows.manage"), getAllConfigsHandler);
router.get("/:entityType", requireConfigReadAccess, getConfigHandler);
router.put("/:id", requirePermission("workflows.manage"), updateConfigHandler);
router.post("/seed/:entityType", requirePermission("workflows.manage"), seedConfigHandler);
router.post("/reseed/:entityType", requirePermission("workflows.manage"), reseedConfigHandler);

export default router;
