import { Router, type Router as ExpressRouter } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  getUserByIdHandler,
  getUserEffectiveAccessHandler,
  getUsersHandler,
  resendUserInvitationHandler,
  updateUserHandler,
} from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requireAnyScopedPermission("users.read"), getUsersHandler);
router.get(
  "/:id/effective-access",
  requireAnyScopedPermission("users.read"),
  getUserEffectiveAccessHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("users.read"),
  getUserByIdHandler,
);
router.post("/", requireAnyScopedPermission("users.write"), createUserHandler);
router.post(
  "/:id/invitation",
  requireAnyScopedPermission("users.write"),
  resendUserInvitationHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("users.write"),
  updateUserHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("users.write"),
  deleteUserHandler,
);

export default router;
