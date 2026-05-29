import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import auditLogRoutes from "./api/routes/auditLogRoutes.js";
import authRoutes from "./api/routes/authRoutes.js";
import categoryRoutes from "./api/routes/categoryRoutes.js";
import inventoryRoutes from "./api/routes/inventoryRoutes.js";
import locationRoutes from "./api/routes/locationRoutes.js";
import organizationRoutes from "./api/routes/organizationRoutes.js";
import productRoutes from "./api/routes/productRoutes.js";
import roleRoutes from "./api/routes/roleRoutes.js";
import userRoutes from "./api/routes/userRoutes.js";
import warehouseRoutes from "./api/routes/warehouseRoutes.js";
import importVoucherRoutes from "./api/routes/importVoucherRoutes.js";
import approvalRoutes from "./api/routes/approvalRoutes.js";
import processConfigRoutes from "./api/routes/processConfigRoutes.js";

const app = express();
const PORT = process.env.BE_WMS_PORT || 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.BE_WMS_CORS_ORIGIN?.split(",") ?? [
      "http://localhost:3000",
      "http://app.wms.localhost",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/products", productRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/import-vouchers", importVoucherRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/process-configs", processConfigRoutes);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get("/", (_req, res) => {
  res.json({
    service: "be-wms",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.info(`[be-wms] Server running on port ${PORT}`);
});
