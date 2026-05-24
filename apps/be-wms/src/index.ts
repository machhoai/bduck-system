import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./api/routes/authRoutes.js";
import categoryRoutes from "./api/routes/categoryRoutes.js";
import productRoutes from "./api/routes/productRoutes.js";

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
      "http://app.wms.localhost"
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);

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
