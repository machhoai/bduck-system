import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  getInvoiceSourceOrderHandler,
  listInvoiceSourceOrdersHandler,
  previewInvoiceSourceOrderHandler,
  syncInvoiceOrdersHandler,
} from "../controllers/invoiceOrderSyncController.js";
import {
  getInvoiceDocumentHandler,
  prepareInvoiceDocumentHandler,
  previewInvoiceDocumentHandler,
  updateInvoiceDocumentHandler,
} from "../controllers/invoiceDocumentController.js";
import {
  createInvoiceBulkIssueHandler,
  createInvoiceIssueJobHandler,
  getInvoiceIssueJobHandler,
  previewInvoiceBulkIssueHandler,
  processInvoiceIssueItemHandler,
  sweepInvoiceIssueItemsHandler,
} from "../controllers/invoiceIssueController.js";
import {
  downloadPublishedInvoiceHandler,
  listInvoiceLedgerHandler,
  listMisaInvoicesHandler,
  listInvoiceReconciliationCasesHandler,
  resolveInvoiceReconciliationCaseHandler,
  sweepIssuedInvoiceStatusesHandler,
  viewPublishedInvoiceHandler,
} from "../controllers/invoiceReconciliationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const queryWarehouseId = (req: Request) =>
  typeof req.query.warehouse_id === "string" ? req.query.warehouse_id : null;
const bodyWarehouseId = (req: Request) =>
  typeof req.body?.warehouse_id === "string" ? req.body.warehouse_id : null;

router.post(
  "/internal/issues/:jobId/items/:itemId/process",
  processInvoiceIssueItemHandler,
);
router.post("/internal/issues/sweep", sweepInvoiceIssueItemsHandler);
router.post("/internal/reconciliation/status-sweep", sweepIssuedInvoiceStatusesHandler);

router.use(requireAuth);
router.post(
  "/bulk-issues/preview",
  requirePermission("invoices.bulk_issue", bodyWarehouseId),
  previewInvoiceBulkIssueHandler,
);
router.post(
  "/bulk-issues",
  requirePermission("invoices.bulk_issue", bodyWarehouseId),
  createInvoiceBulkIssueHandler,
);
router.post(
  "/issues",
  requirePermission("invoices.issue", bodyWarehouseId),
  createInvoiceIssueJobHandler,
);
router.get(
  "/issues/:jobId",
  requirePermission("invoices.read", queryWarehouseId),
  getInvoiceIssueJobHandler,
);
router.get(
  "/ledger",
  requirePermission("invoices.read", queryWarehouseId),
  listInvoiceLedgerHandler,
);
router.get(
  "/misa-invoices",
  requirePermission("invoices.read", queryWarehouseId),
  listMisaInvoicesHandler,
);
router.get(
  "/reconciliation-cases",
  requirePermission("invoices.read", queryWarehouseId),
  listInvoiceReconciliationCasesHandler,
);
router.post(
  "/reconciliation-cases/:id/resolve",
  requirePermission("invoices.reconcile", bodyWarehouseId),
  resolveInvoiceReconciliationCaseHandler,
);
router.get(
  "/ledger/:id/view",
  requirePermission("invoices.download", queryWarehouseId),
  viewPublishedInvoiceHandler,
);
router.get(
  "/ledger/:id/download",
  requirePermission("invoices.download", queryWarehouseId),
  downloadPublishedInvoiceHandler,
);
router.post(
  "/source-orders/sync",
  requireAnyScopedPermission(["invoices.prepare", "invoices.reconcile"]),
  syncInvoiceOrdersHandler,
);
router.get(
  "/source-orders",
  requirePermission("invoices.read", queryWarehouseId),
  listInvoiceSourceOrdersHandler,
);
router.post(
  "/source-orders/:id/prepare",
  requirePermission("invoices.prepare", bodyWarehouseId),
  prepareInvoiceDocumentHandler,
);
router.get(
  "/documents/:id",
  requirePermission("invoices.read", queryWarehouseId),
  getInvoiceDocumentHandler,
);
router.put(
  "/documents/:id",
  requirePermission("invoices.prepare", bodyWarehouseId),
  updateInvoiceDocumentHandler,
);
router.post(
  "/documents/:id/preview",
  requirePermission("invoices.prepare", bodyWarehouseId),
  previewInvoiceDocumentHandler,
);
router.post(
  "/source-orders/:id/preview",
  requirePermission("invoices.prepare", bodyWarehouseId),
  previewInvoiceSourceOrderHandler,
);
router.get(
  "/source-orders/:id",
  requirePermission("invoices.read", queryWarehouseId),
  getInvoiceSourceOrderHandler,
);

export default router;
