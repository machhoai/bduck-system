import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  approveAttendanceWorkArrangementHandler,
  cancelAttendanceWorkArrangementHandler,
  checkInAttendanceHandler,
  createLateArrivalReportHandler,
  getAttendanceContextHandler,
  getAttendanceExemptionsHandler,
  getAttendancePoliciesHandler,
  getAttendanceWorkArrangementsHandler,
  updateAttendanceExemptionsHandler,
  updateAttendancePolicyHandler,
} from "../controllers/attendanceController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const warehouseParam = (req: Request) => {
  const value = req.params.warehouseId;
  return Array.isArray(value) ? value[0] : value;
};

router.use(requireAuth);

router.get(
  "/context",
  requireAnyScopedPermission([
    "attendance.check_in",
    "attendance.view",
    "attendance.export",
    "attendance.config",
  ]),
  getAttendanceContextHandler,
);
router.post("/check-in", checkInAttendanceHandler);
router.post("/late-reports", createLateArrivalReportHandler);
router.get(
  "/policies",
  requireAnyScopedPermission("attendance.config"),
  getAttendancePoliciesHandler,
);
router.put(
  "/policies/:warehouseId",
  requirePermission("attendance.config", warehouseParam),
  updateAttendancePolicyHandler,
);
router.get(
  "/exemptions/:warehouseId",
  requirePermission("attendance.config", warehouseParam),
  getAttendanceExemptionsHandler,
);
router.put(
  "/exemptions/:warehouseId",
  requirePermission("attendance.config", warehouseParam),
  updateAttendanceExemptionsHandler,
);
router.get(
  "/work-arrangements/:warehouseId",
  requirePermission("attendance.config", warehouseParam),
  getAttendanceWorkArrangementsHandler,
);
router.post(
  "/work-arrangements/:warehouseId",
  requirePermission("attendance.config", warehouseParam),
  approveAttendanceWorkArrangementHandler,
);
router.patch(
  "/work-arrangements/:warehouseId/:arrangementId/cancel",
  requirePermission("attendance.config", warehouseParam),
  cancelAttendanceWorkArrangementHandler,
);

export default router;
