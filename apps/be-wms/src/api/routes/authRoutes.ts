import { Router, type Router as ExpressRouter } from "express";
import { sessionLogin, logout, setupMfa, verifySetupMfa, sendEmailOtp, checkMfa } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router: ExpressRouter = Router();

router.post("/sessionLogin", sessionLogin);
router.post("/logout", logout);

router.post("/mfa/setup", requireAuth, setupMfa);
router.post("/mfa/verify-setup", requireAuth, verifySetupMfa);
router.post("/mfa/send-email", requireAuth, sendEmailOtp);
router.post("/mfa/verify", requireAuth, checkMfa);

export default router;
