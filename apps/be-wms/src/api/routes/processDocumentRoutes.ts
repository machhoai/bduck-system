import { Router, type Router as ExpressRouter } from "express";
import {
  createProcessDocumentHandler,
  deleteProcessDocumentHandler,
  getProcessDocumentsHandler,
} from "../controllers/processDocumentController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
router.use(requireAuth);
router.get(
  "/",
  requireAnyScopedPermission("process_documents.view"),
  getProcessDocumentsHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("process_documents.upload"),
  createProcessDocumentHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("process_documents.delete"),
  deleteProcessDocumentHandler,
);

export default router;
