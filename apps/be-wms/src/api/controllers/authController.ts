import { Request, Response } from "express";
import { z } from "zod";
import {
  createSessionLogin,
  logoutSession,
} from "../../services/authService.js";
import {
  completeAccountInvitation,
  verifyAccountInvitation,
} from "../../services/accountInvitationService.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import {
  generateMfaSetup,
  verifyMfaSetup,
  sendMfaEmailOtp,
  verifyMfa,
} from "../../services/mfaService.js";

const sessionLoginSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const accountInvitationTokenSchema = z.object({
  token: z.string().trim().min(32).max(512),
});

const completeAccountInvitationSchema = accountInvitationTokenSchema.extend({
  password: z.string().min(8).max(128),
});

const handleAccountInvitationError = (res: Response, error: unknown) => {
  console.error("[authController] account invitation error:", error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      data: error.flatten(),
      messages: {
        vi: "Dữ liệu khởi tạo tài khoản không hợp lệ.",
        zh: "账户初始化数据无效。",
      },
    });
  }

  const firebaseMapped = mapFirebaseError(error);
  if (firebaseMapped) {
    return res.status(firebaseMapped.statusCode).json({
      success: false,
      data: null,
      messages: firebaseMapped.messages,
    });
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  if (apiError.statusCode && apiError.messages) {
    return res.status(apiError.statusCode).json({
      success: false,
      data: null,
      messages: apiError.messages,
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    messages: {
      vi: "Lỗi hệ thống khi khởi tạo tài khoản.",
      zh: "账户初始化时发生系统错误。",
    },
  });
};

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
    const firebaseMapped = mapFirebaseError(error);
    if (firebaseMapped) {
      return res.status(firebaseMapped.statusCode).json({
        success: false,
        data: null,
        messages: firebaseMapped.messages,
      });
    }

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

export const verifyAccountInvitationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token } = accountInvitationTokenSchema.parse(req.body);
    const invitation = await verifyAccountInvitation(token);
    return res.status(200).json({
      success: true,
      data: invitation,
      messages: {
        vi: "Liên kết khởi tạo tài khoản hợp lệ.",
        zh: "账户初始化链接有效。",
      },
    });
  } catch (error) {
    return handleAccountInvitationError(res, error);
  }
};

export const completeAccountInvitationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token, password } = completeAccountInvitationSchema.parse(req.body);
    await completeAccountInvitation(token, password);
    return res.status(200).json({
      success: true,
      data: null,
      messages: {
        vi: "Đã đặt mật khẩu thành công. Vui lòng đăng nhập.",
        zh: "密码设置成功。请登录。",
      },
    });
  } catch (error) {
    return handleAccountInvitationError(res, error);
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

export const setupMfa = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({
        success: false,
        messages: { vi: "Unauthorized", zh: "未经授权" },
      });

    const result = await generateMfaSetup(user.id, email || user.email);

    return res.status(200).json({
      success: true,
      data: result,
      messages: { vi: "Lấy QR code thành công.", zh: "获取 QR 码成功。" },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      messages: { vi: "Lỗi hệ thống.", zh: "系统错误。" },
    });
  }
};

export const verifySetupMfa = async (req: Request, res: Response) => {
  try {
    const { token, secret } = req.body;
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({
        success: false,
        messages: { vi: "Unauthorized", zh: "未经授权" },
      });

    const isValid = await verifyMfaSetup(user.id, token, secret);

    if (isValid) {
      return res.status(200).json({
        success: true,
        data: null,
        messages: { vi: "Xác thực thành công.", zh: "验证成功。" },
      });
    } else {
      return res.status(400).json({
        success: false,
        data: null,
        messages: { vi: "Mã OTP không hợp lệ.", zh: "无效的 OTP 码。" },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      messages: { vi: "Lỗi hệ thống.", zh: "系统错误。" },
    });
  }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({
        success: false,
        messages: { vi: "Unauthorized", zh: "未经授权" },
      });

    await sendMfaEmailOtp(user.id, user.email);

    return res.status(200).json({
      success: true,
      data: null,
      messages: {
        vi: "Đã gửi mã xác thực qua email.",
        zh: "已通过电子邮件发送验证码。",
      },
    });
  } catch (error: any) {
    console.error(error);
    if (error.statusCode && error.messages) {
      return res
        .status(error.statusCode)
        .json({ success: false, messages: error.messages });
    }
    return res.status(500).json({
      success: false,
      messages: { vi: "Lỗi hệ thống.", zh: "系统错误。" },
    });
  }
};

export const checkMfa = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({
        success: false,
        messages: { vi: "Unauthorized", zh: "未经授权" },
      });

    const isValid = await verifyMfa(user.id, token);

    if (isValid) {
      return res.status(200).json({
        success: true,
        data: null,
        messages: { vi: "Xác thực thành công.", zh: "验证成功。" },
      });
    } else {
      return res.status(400).json({
        success: false,
        data: null,
        messages: { vi: "Mã OTP không hợp lệ.", zh: "无效的 OTP 码。" },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      messages: { vi: "Lỗi hệ thống.", zh: "系统错误。" },
    });
  }
};
