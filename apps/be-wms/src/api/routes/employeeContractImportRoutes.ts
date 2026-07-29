import { Router, type Router as ExpressRouter } from "express";

import {
  commitEmployeeContractImportHandler,
  createEmployeeContractImportUploadSessionHandler,
  getEmployeeContractImportHandler,
  previewEmployeeContractImportHandler,
} from "../controllers/employeeContractImportController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireEmployeeContractFeatureEnabled } from "../middlewares/employeeContractFeatureGate.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);
router.use(requireEmployeeContractFeatureEnabled);
router.use(
  requireAnyScopedPermission("employees.contracts.history.import"),
);
router.post(
  "/upload-sessions",
  createEmployeeContractImportUploadSessionHandler,
);
router.post("/preview", previewEmployeeContractImportHandler);
router.get("/:batchId", getEmployeeContractImportHandler);
router.post("/:batchId/commit", commitEmployeeContractImportHandler);

export default router;
