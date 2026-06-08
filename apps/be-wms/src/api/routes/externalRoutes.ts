import { Router } from "express";
import externalScanController from "../controllers/externalScanController.js";
import { requireApiKey } from "../middlewares/apiKeyMiddleware.js";

const router: Router = Router();

// /api/external/v1/locations
router.get("/locations", requireApiKey(["locations.read"]), externalScanController.getLocations);

// /api/external/v1/products
router.get("/products", requireApiKey(["products.read"]), externalScanController.getProducts);

// /api/external/v1/scan
router.post("/scan", requireApiKey(["scan"]), externalScanController.scan);

// /api/external/v1/scan/:scanId
router.delete("/scan/:scanId", requireApiKey(["scan"]), externalScanController.cancelScan);

// /api/external/v1/batch-submit
router.post("/batch-submit", requireApiKey(["scan"]), externalScanController.submitBatch);

export default router;
