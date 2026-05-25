import { Router, type Router as ExpressRouter } from "express";
import { sessionLogin, logout } from "../controllers/authController.js";

const router: ExpressRouter = Router();

router.post("/sessionLogin", sessionLogin);
router.post("/logout", logout);

export default router;
