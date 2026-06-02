import { Request, Response } from "express";
import { z } from "zod";
import {
  createSessionLogin,
  logoutSession,
} from "../../services/authService.js";

const sessionLoginSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

export const sessionLogin = async (req: Request, res: Response) => {
  try {
    const parseResult = sessionLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi: "Dữ liệu đầu vào không hợp lệ.",
          zh: "输入数据无效。",
        },
      });
    }

    const { idToken } = parseResult.data;

    // Create session and get user + permissions
    const sessionResult = await createSessionLogin(idToken);

    // Set HttpOnly cookie
    res.cookie("__session", sessionResult.cookie, {
      maxAge: sessionResult.expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({
      success: true,
      data: {
        user: sessionResult.user,
        permissions: sessionResult.permissions,
        roles: sessionResult.roles,
      },
      messages: {
        vi: "Đăng nhập thành công.",
        zh: "登录成功。",
      },
    });
  } catch (error: any) {
    console.error("[authController] sessionLogin error:", error);
    return res.status(401).json({
      success: false,
      data: null,
      messages: {
        vi: "Đăng nhập thất bại hoặc tài khoản không tồn tại.",
        zh: "登录失败或账户不存在。",
      },
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const sessionCookie = req.cookies?.__session || "";
    if (sessionCookie) {
      await logoutSession(sessionCookie);
    }

    res.clearCookie("__session");

    return res.status(200).json({
      success: true,
      data: null,
      messages: {
        vi: "Đăng xuất thành công.",
        zh: "登出成功。",
      },
    });
  } catch (error) {
    console.error("[authController] logout error:", error);
    return res.status(500).json({
      success: false,
      data: null,
      messages: {
        vi: "Lỗi hệ thống khi đăng xuất.",
        zh: "登出时发生系统错误。",
      },
    });
  }
};
