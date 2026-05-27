import { Router, type Router as ExpressRouter } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  getUserByIdHandler,
  getUsersHandler,
  updateUserHandler,
} from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("users.read"), getUsersHandler);
router.get("/:id", requirePermission("users.read"), getUserByIdHandler);
router.post("/", requirePermission("users.write"), createUserHandler);
router.put("/:id", requirePermission("users.write"), updateUserHandler);
router.delete("/:id", requirePermission("users.write"), deleteUserHandler);

export default router;
