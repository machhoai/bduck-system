import { Router, type Router as ExpressRouter } from "express";
import {
  checkMfa,
  completeAccountInvitationHandler,
  logout,
  requestPasswordResetHandler,
  resolveLoginIdentifier,
  sendEmailOtp,
  sessionLogin,
  currentSession,
  setupMfa,
  verifyAccountInvitationHandler,
  verifySetupMfa,
} from "../controllers/authController.js";
import { requireIdentityAuth } from "../middlewares/authMiddleware.js";
import {
  authRateLimiter,
  authSessionRateLimiter,
} from "../middlewares/rateLimitMiddleware.js";

const router: ExpressRouter = Router();

router.post("/sessionLogin", authSessionRateLimiter, sessionLogin);
router.get("/session", requireIdentityAuth, currentSession);
router.post("/login/resolve", authRateLimiter, resolveLoginIdentifier);
router.post("/logout", logout);
router.post(
  "/account-invitations/verify",
  authRateLimiter,
  verifyAccountInvitationHandler,
);
router.post(
  "/account-invitations/complete",
  authRateLimiter,
  completeAccountInvitationHandler,
);
router.post(
  "/password-reset/request",
  authRateLimiter,
  requestPasswordResetHandler,
);

router.post("/mfa/setup", requireIdentityAuth, setupMfa);
router.post("/mfa/verify-setup", requireIdentityAuth, verifySetupMfa);
router.post(
  "/mfa/send-email",
  authRateLimiter,
  requireIdentityAuth,
  sendEmailOtp,
);
router.post("/mfa/verify", authRateLimiter, requireIdentityAuth, checkMfa);

export default router;
