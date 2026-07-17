import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { UserStatus } from "@bduck/shared-types";
import { auth } from "../../config/firebase.js";
import { loadAuthorizationRequestSource } from "../../repositories/authorizationSourceRepository.js";
import { getUserById } from "../../repositories/userRepository.js";
import {
  AuthorizationError,
  buildAccessContext,
} from "../../services/authorization/index.js";
import {
  getAuthorizationRolloutMode,
  resolveAuthorizationContext,
} from "../../services/authorizationRolloutService.js";
import {
  attachRequestAccess,
  createAuthenticatedRequestUser,
} from "./requestAccessContext.js";
import { createRequireIdentityAuth } from "./identityAuthMiddleware.js";

const verifyRequestClaims = async (
  req: Request,
): Promise<DecodedIdToken | null> => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader?.startsWith("Bearer ") === true
      ? authHeader.slice("Bearer ".length)
      : "";
  const sessionCookie = req.cookies?.__session || "";

  if (bearerToken) {
    try {
      return await auth.verifyIdToken(bearerToken, true);
    } catch {
      // A valid session cookie may still authenticate this request.
    }
  }
  if (sessionCookie) {
    try {
      return await auth.verifySessionCookie(sessionCookie, true);
    } catch {
      return null;
    }
  }
  return null;
};

const sendUnauthenticated = (res: Response) =>
  res.status(401).json({
    success: false,
    data: null,
    messages: {
      vi: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      zh: "登录会话无效或已过期。",
    },
  });

const sendAuthorizationError = (res: Response, error: AuthorizationError) =>
  res.status(error.statusCode).json({
    success: false,
    data: null,
    messages: error.messages,
  });

export const requireIdentityAuth = createRequireIdentityAuth({
  verifyClaims: verifyRequestClaims,
  loadUser: getUserById,
});

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const decodedClaims = await verifyRequestClaims(req);
  if (!decodedClaims) return sendUnauthenticated(res);

  try {
    const { snapshot, requestUser } = await loadAuthorizationRequestSource(
      decodedClaims.uid,
    );
    const user = requestUser;
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthorizationError("AUTHORIZATION_ACTOR_INACTIVE");
    }
    const rolloutMode = getAuthorizationRolloutMode();
    const liveContext =
      rolloutMode === "SHADOW" ? buildAccessContext(snapshot) : null;
    const accessContext = await resolveAuthorizationContext(
      decodedClaims.uid,
      liveContext,
      rolloutMode,
    );
    const authenticatedUser = createAuthenticatedRequestUser(
      snapshot,
      accessContext,
      user,
    );
    attachRequestAccess(req, accessContext, authenticatedUser);
    return next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return sendAuthorizationError(res, error);
    }

    console.error("[authMiddleware] authorization context error:", error);
    return res.status(500).json({
      success: false,
      data: null,
      messages: {
        vi: "Không thể tải thông tin phân quyền. Vui lòng thử lại sau.",
        zh: "无法加载授权信息，请稍后重试。",
      },
    });
  }
};
