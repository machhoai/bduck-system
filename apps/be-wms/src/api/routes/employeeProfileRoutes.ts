import { Router, type Router as ExpressRouter } from "express";
import {
  createEmployeeProfileHandler,
  deleteEmployeeProfileHandler,
  getEmployeeProfileByIdHandler,
  getEmployeeProfilesHandler,
  getMyEmployeeProfileHandler,
  updateEmployeeProfileHandler,
} from "../controllers/employeeProfileController.js";
import {
  applyDueEmployeeEmploymentTransitionsHandler,
  cancelEmployeeEmploymentTransitionHandler,
  createEmployeeEmploymentTransitionHandler,
  getEmployeeEmploymentTransitionsHandler,
} from "../controllers/employeeEmploymentController.js";
import {
  cancelEmployeeContractHandler,
  createEmployeeContractHandler,
  listEmployeeContractsHandler,
  renewEmployeeContractHandler,
  terminateEmployeeContractHandler,
  updateEmployeeContractHandler,
} from "../controllers/employeeContractController.js";
import {
  createEmployeeContractDocumentUploadIntentHandler,
  finalizeEmployeeContractDocumentUploadHandler,
  getEmployeeContractDocumentDownloadHandler,
  listEmployeeContractDocumentsHandler,
} from "../controllers/employeeContractDocumentController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";
import { requireEmployeeContractFeatureEnabled } from "../middlewares/employeeContractFeatureGate.js";

const router: ExpressRouter = Router();

router.post(
  "/cron/employment-transitions/apply-due",
  applyDueEmployeeEmploymentTransitionsHandler,
);

router.use(requireAuth);

router.get("/me", getMyEmployeeProfileHandler);
router.use("/:id/contracts", requireEmployeeContractFeatureEnabled);
router.get(
  "/:id/contracts",
  requireAnyScopedPermission([
    "employees.contracts.read",
    "employees.contracts.self.read",
  ]),
  listEmployeeContractsHandler,
);
router.post(
  "/:id/contracts",
  requireAnyScopedPermission("employees.contracts.manage"),
  createEmployeeContractHandler,
);
router.put(
  "/:id/contracts/:contractId",
  requireAnyScopedPermission("employees.contracts.manage"),
  updateEmployeeContractHandler,
);
router.post(
  "/:id/contracts/:contractId/renew",
  requireAnyScopedPermission("employees.contracts.manage"),
  renewEmployeeContractHandler,
);
router.post(
  "/:id/contracts/:contractId/cancel",
  requireAnyScopedPermission("employees.contracts.terminate"),
  cancelEmployeeContractHandler,
);
router.post(
  "/:id/contracts/:contractId/terminate",
  requireAnyScopedPermission("employees.contracts.terminate"),
  terminateEmployeeContractHandler,
);
router.post(
  "/:id/contracts/:contractId/documents/upload-intents",
  requireAnyScopedPermission("employees.contracts.documents.manage"),
  createEmployeeContractDocumentUploadIntentHandler,
);
router.post(
  "/:id/contracts/:contractId/documents/upload-intents/:intentId/finalize",
  requireAnyScopedPermission("employees.contracts.documents.manage"),
  finalizeEmployeeContractDocumentUploadHandler,
);
router.get(
  "/:id/contracts/:contractId/documents",
  requireAnyScopedPermission([
    "employees.contracts.documents.read",
    "employees.contracts.self.read",
  ]),
  listEmployeeContractDocumentsHandler,
);
router.get(
  "/:id/contracts/:contractId/documents/:documentId/download",
  requireAnyScopedPermission([
    "employees.contracts.documents.read",
    "employees.contracts.self.read",
  ]),
  getEmployeeContractDocumentDownloadHandler,
);
router.post(
  "/employment-transitions/:transitionId/cancel",
  requireAnyScopedPermission("employees.employment.manage"),
  cancelEmployeeEmploymentTransitionHandler,
);
router.get(
  "/:id/employment-transitions",
  requireAnyScopedPermission("employees.read"),
  getEmployeeEmploymentTransitionsHandler,
);
router.post(
  "/:id/employment-transitions",
  requireAnyScopedPermission("employees.employment.manage"),
  createEmployeeEmploymentTransitionHandler,
);
router.get(
  "/",
  requireAnyScopedPermission("employees.read"),
  getEmployeeProfilesHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("employees.read"),
  getEmployeeProfileByIdHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("employees.write"),
  createEmployeeProfileHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("employees.write"),
  updateEmployeeProfileHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("employees.write"),
  deleteEmployeeProfileHandler,
);

export default router;
