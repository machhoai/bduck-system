import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  createMeInvoiceAccountHandler,
  getMeInvoiceStoreConfigHandler,
  listMeInvoiceAccountsHandler,
  saveMeInvoiceStoreConfigHandler,
  testMeInvoiceAccountHandler,
  updateMeInvoiceAccountHandler,
  validateMeInvoiceStoreConfigHandler,
} from "../controllers/meInvoiceConfigController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requirePermission,
  requireSystemAdmin,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const warehouseId = (req: Request) => {
  const value = req.params.warehouseId;
  return typeof value === "string" ? value : null;
};

router.use(requireAuth);
router.get("/accounts", requireSystemAdmin, listMeInvoiceAccountsHandler);
router.post("/accounts", requireSystemAdmin, createMeInvoiceAccountHandler);
router.put("/accounts/:id", requireSystemAdmin, updateMeInvoiceAccountHandler);
router.post("/accounts/:id/test", requireSystemAdmin, testMeInvoiceAccountHandler);

router.get(
  "/store-configs/:warehouseId",
  requirePermission("invoices.config", warehouseId),
  getMeInvoiceStoreConfigHandler,
);
router.put(
  "/store-configs/:warehouseId",
  requirePermission("invoices.config", warehouseId),
  saveMeInvoiceStoreConfigHandler,
);
router.post(
  "/store-configs/:warehouseId/validate",
  requirePermission("invoices.config", warehouseId),
  validateMeInvoiceStoreConfigHandler,
);

export default router;
