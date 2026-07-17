import type { NextFunction, Request, Response } from "express";
import type { User } from "@bduck/shared-types";
import { AuthorizationError } from "../../services/authorization/index.js";
import { createAuthenticatedIdentityRequestUser } from "./requestAccessContext.js";

export interface IdentityAuthDependencies {
  verifyClaims: (req: Request) => Promise<{ uid: string } | null>;
  loadUser: (userId: string) => Promise<User | null>;
}

const sendUnauthenticated = (res: Response) =>
  res.status(401).json({
    success: false,
    data: null,
    messages: {
      vi: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      zh: "登录会话无效或已过期。",
    },
  });

export const createRequireIdentityAuth =
  (dependencies: IdentityAuthDependencies) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedClaims = await dependencies.verifyClaims(req);
    if (!decodedClaims) return sendUnauthenticated(res);

    try {
      req.user = createAuthenticatedIdentityRequestUser(
        decodedClaims.uid,
        await dependencies.loadUser(decodedClaims.uid),
      );
      return next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(error.statusCode).json({
          success: false,
          data: null,
          messages: error.messages,
        });
      }

      console.error("[identityAuthMiddleware] identity context error:", error);
      return res.status(500).json({
        success: false,
        data: null,
        messages: {
          vi: "Không thể tải thông tin tài khoản. Vui lòng thử lại sau.",
          zh: "无法加载账户信息，请稍后重试。",
        },
      });
    }
  };
