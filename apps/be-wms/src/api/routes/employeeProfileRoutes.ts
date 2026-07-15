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
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/me", getMyEmployeeProfileHandler);
router.get(
  "/",
  requireAnyScopedPermission("employees.read"),
  getEmployeeProfilesHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("employees.read"),
  getEmployeeProfileByIdHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("employees.write"),
  createEmployeeProfileHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("employees.write"),
  updateEmployeeProfileHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("employees.write"),
  deleteEmployeeProfileHandler,
);

export default router;
