import { Router } from "express";
import externalScanController from "../controllers/externalScanController.js";
import {
  getExternalCountStateHandler,
  submitExternalCountCheckpointHandler,
} from "../controllers/stockCountController.js";
import { requireApiKey } from "../middlewares/apiKeyMiddleware.js";

const router: Router = Router();

// /api/external/v1/warehouses
router.get("/warehouses", requireApiKey(["locations.read"]), externalScanController.getWarehouses);

// /api/external/v1/locations
router.get("/locations", requireApiKey(["locations.read"]), externalScanController.getLocations);

// /api/external/v1/products
router.get("/products", requireApiKey(["products.read"]), externalScanController.getProducts);

// /api/external/v1/scan
router.post("/scan", requireApiKey(["scan"]), externalScanController.scan);
router.get("/scan", requireApiKey(["scan"]), externalScanController.getMyScans);

// /api/external/v1/location-queue
router.get("/location-queue", requireApiKey(["scan"]), externalScanController.getLocationScans);

// /api/external/v1/count
router.get("/count/state", requireApiKey(["external_count.read"]), getExternalCountStateHandler);
router.post("/count", requireApiKey(["external_count.write"]), submitExternalCountCheckpointHandler);

// /api/external/v1/scan/:scanId
router.delete("/scan/:scanId", requireApiKey(["external_scan.manage_queue"]), externalScanController.cancelScan);

// /api/external/v1/batch-submit
router.post("/batch-submit", requireApiKey(["scan"]), externalScanController.submitBatch);

export default router;
