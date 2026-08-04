import { Router, type Router as ExpressRouter } from "express";
import {
  getCustomerInvoiceRequestHandler,
  lookupCustomerTaxCodeHandler,
  submitCustomerInvoiceRequestHandler,
} from "../controllers/customerInvoiceRequestController.js";
import {
  publicInvoiceReadRateLimiter,
  publicInvoiceSubmitRateLimiter,
} from "../middlewares/rateLimitMiddleware.js";

const router: ExpressRouter = Router();

router.get(
  "/:token",
  publicInvoiceReadRateLimiter,
  getCustomerInvoiceRequestHandler,
);
router.get(
  "/:token/tax-id/:taxCode",
  publicInvoiceReadRateLimiter,
  lookupCustomerTaxCodeHandler,
);
router.post(
  "/:token/submissions",
  publicInvoiceSubmitRateLimiter,
  submitCustomerInvoiceRequestHandler,
);

export default router;
