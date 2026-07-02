import { Router, type Router as ExpressRouter } from "express";
import {
  createEmployeeProfileHandler,
  deleteEmployeeProfileHandler,
  getEmployeeProfileByIdHandler,
  getEmployeeProfilesHandler,
  getMyEmployeeProfileHandler,
  updateEmployeeProfileHandler,
} from "../controllers/employeeProfileController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/me", getMyEmployeeProfileHandler);
router.get("/", requirePermission("employees.read"), getEmployeeProfilesHandler);
router.get("/:id", requirePermission("employees.read"), getEmployeeProfileByIdHandler);
router.post("/", requirePermission("employees.write"), createEmployeeProfileHandler);
router.put("/:id", requirePermission("employees.write"), updateEmployeeProfileHandler);
router.delete(
  "/:id",
  requirePermission("employees.write"),
  deleteEmployeeProfileHandler,
);

export default router;
