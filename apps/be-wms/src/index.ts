import cors from "cors";
import express from "express";
import helmet from "helmet";

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
    ],
    credentials: true,
  }),
);
app.use(express.json());

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
