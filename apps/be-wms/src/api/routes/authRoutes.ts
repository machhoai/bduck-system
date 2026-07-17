import { Router, type Router as ExpressRouter } from "express";
import {
  checkMfa,
  completeAccountInvitationHandler,
  logout,
  requestPasswordResetHandler,
  resolveLoginIdentifier,
  sendEmailOtp,
  sessionLogin,
  setupMfa,
  verifyAccountInvitationHandler,
  verifySetupMfa,
} from "../controllers/authController.js";
import { requireIdentityAuth } from "../middlewares/authMiddleware.js";

const router: ExpressRouter = Router();

router.post("/sessionLogin", sessionLogin);
router.post("/login/resolve", resolveLoginIdentifier);
router.post("/logout", logout);
router.post("/account-invitations/verify", verifyAccountInvitationHandler);
router.post("/account-invitations/complete", completeAccountInvitationHandler);
router.post("/password-reset/request", requestPasswordResetHandler);

router.post("/mfa/setup", requireIdentityAuth, setupMfa);
router.post("/mfa/verify-setup", requireIdentityAuth, verifySetupMfa);
router.post("/mfa/send-email", requireIdentityAuth, sendEmailOtp);
router.post("/mfa/verify", requireIdentityAuth, checkMfa);

export default router;
