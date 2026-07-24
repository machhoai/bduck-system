import { Router, type Router as ExpressRouter } from "express";
import {
  getMyLeaveBalanceHandler,
  runLeaveMaintenanceHandler,
} from "../controllers/leaveBalanceController.js";
import {
  createCompanyHolidayHandler,
  deleteCompanyHolidayHandler,
  listCompanyHolidaysHandler,
} from "../controllers/leaveHolidayController.js";
import {
  cancelMyLeaveRequestHandler,
  createMyLeaveRequestHandler,
  listMyLeaveRequestsHandler,
  submitMyLeaveRequestHandler,
} from "../controllers/leaveRequestController.js";
import {
  getLeaveApprovalConfigHandler,
  getLeaveApprovalConfigOptionsHandler,
  putLeaveApprovalConfigHandler,
} from "../controllers/leaveApprovalConfigController.js";
import {
  decideLeaveApprovalTaskHandler,
  listMyLeaveApprovalTasksHandler,
  listUnavailableLeaveApprovalTasksHandler,
  reassignLeaveApprovalTaskHandler,
} from "../controllers/leaveApprovalController.js";
import {
  commitLeaveImportHandler,
  getLeaveImportHandler,
  listLeaveImportsHandler,
  previewLeaveImportHandler,
} from "../controllers/leaveImportController.js";
import {
  getEmployeeLeaveBalanceHandler,
  getLeavePolicyHandler,
  listCompanyLeaveRequestsHandler,
  listLeaveBalanceProfilesHandler,
  postLeaveBalanceAdjustmentHandler,
  putLeavePolicyHandler,
} from "../controllers/leaveAdministrationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireLeaveFeatureEnabled } from "../middlewares/leaveFeatureGate.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.post("/cron/maintenance", runLeaveMaintenanceHandler);

router.use(requireAuth);
router.use(requireLeaveFeatureEnabled);
router.get(
  "/policy",
  requireAnyScopedPermission("leave.config.manage"),
  getLeavePolicyHandler,
);
router.put(
  "/policy",
  requireAnyScopedPermission("leave.config.manage"),
  putLeavePolicyHandler,
);
router.get(
  "/requests",
  requireAnyScopedPermission("leave.requests.read_all"),
  listCompanyLeaveRequestsHandler,
);
router.get(
  "/balance-profiles",
  requireAnyScopedPermission("leave.balance.adjust"),
  listLeaveBalanceProfilesHandler,
);
router.get(
  "/balances/:profileId",
  requireAnyScopedPermission([
    "leave.requests.read_all",
    "leave.balance.adjust",
  ]),
  getEmployeeLeaveBalanceHandler,
);
router.post(
  "/balances/:profileId/adjustments",
  requireAnyScopedPermission("leave.balance.adjust"),
  postLeaveBalanceAdjustmentHandler,
);
router.get(
  "/imports",
  requireAnyScopedPermission("leave.history.import"),
  listLeaveImportsHandler,
);
router.post(
  "/imports/preview",
  requireAnyScopedPermission("leave.history.import"),
  previewLeaveImportHandler,
);
router.get(
  "/imports/:id",
  requireAnyScopedPermission("leave.history.import"),
  getLeaveImportHandler,
);
router.post(
  "/imports/:id/commit",
  requireAnyScopedPermission("leave.history.import"),
  commitLeaveImportHandler,
);
router.get(
  "/approval-config",
  requireAnyScopedPermission("leave.config.manage"),
  getLeaveApprovalConfigHandler,
);
router.get(
  "/approval-config/options",
  requireAnyScopedPermission([
    "leave.config.manage",
    "leave.approver.reassign",
  ]),
  getLeaveApprovalConfigOptionsHandler,
);
router.put(
  "/approval-config",
  requireAnyScopedPermission("leave.config.manage"),
  putLeaveApprovalConfigHandler,
);
router.get(
  "/approval-tasks/me",
  requireAnyScopedPermission("leave.approve"),
  listMyLeaveApprovalTasksHandler,
);
router.get(
  "/approval-tasks/unavailable",
  requireAnyScopedPermission("leave.approver.reassign"),
  listUnavailableLeaveApprovalTasksHandler,
);
router.post(
  "/approval-tasks/:id/decision",
  requireAnyScopedPermission("leave.approve"),
  decideLeaveApprovalTaskHandler,
);
router.post(
  "/approval-tasks/:id/reassign",
  requireAnyScopedPermission("leave.approver.reassign"),
  reassignLeaveApprovalTaskHandler,
);
router.get(
  "/holidays",
  requireAnyScopedPermission([
    "leave.self.read",
    "leave.request.create",
    "leave.holidays.manage",
  ]),
  listCompanyHolidaysHandler,
);
router.post(
  "/holidays",
  requireAnyScopedPermission("leave.holidays.manage"),
  createCompanyHolidayHandler,
);
router.delete(
  "/holidays/:id",
  requireAnyScopedPermission("leave.holidays.manage"),
  deleteCompanyHolidayHandler,
);
router.get(
  "/me/balance",
  requireAnyScopedPermission("leave.self.read"),
  getMyLeaveBalanceHandler,
);
router.get(
  "/me/requests",
  requireAnyScopedPermission("leave.self.read"),
  listMyLeaveRequestsHandler,
);
router.post(
  "/me/requests",
  requireAnyScopedPermission("leave.request.create"),
  createMyLeaveRequestHandler,
);
router.post(
  "/me/requests/:id/submit",
  requireAnyScopedPermission("leave.request.create"),
  submitMyLeaveRequestHandler,
);
router.post(
  "/me/requests/:id/cancel",
  requireAnyScopedPermission("leave.request.create"),
  cancelMyLeaveRequestHandler,
);

export default router;
