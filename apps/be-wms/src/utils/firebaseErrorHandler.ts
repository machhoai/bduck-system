export const mapFirebaseError = (error: any): { statusCode: number; messages: { vi: string; zh: string } } | null => {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    switch (error.code) {
      case "auth/email-already-exists":
        return {
          statusCode: 409,
          messages: {
            vi: "Email này đã được sử dụng bởi một tài khoản khác.",
            zh: "该电子邮件已被另一个帐户使用。",
          },
        };
      case "auth/invalid-password":
      case "auth/weak-password":
        return {
          statusCode: 400,
          messages: {
            vi: "Mật khẩu phải có ít nhất 6 ký tự.",
            zh: "密码必须至少包含6个字符。",
          },
        };
      case "auth/invalid-email":
        return {
          statusCode: 400,
          messages: {
            vi: "Định dạng email không hợp lệ.",
            zh: "电子邮件格式无效。",
          },
        };
      case "auth/user-not-found":
        return {
          statusCode: 404,
          messages: {
            vi: "Không tìm thấy tài khoản trong hệ thống xác thực.",
            zh: "在身份验证系统中找不到该帐户。",
          },
        };
      case "auth/operation-not-allowed":
        return {
          statusCode: 403,
          messages: {
            vi: "Phương thức đăng nhập này chưa được kích hoạt trên Firebase.",
            zh: "此登录方法尚未在Firebase上启用。",
          },
        };
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return {
          statusCode: 401,
          messages: {
            vi: "Thông tin đăng nhập không chính xác.",
            zh: "登录信息不正确。",
          },
        };
      default:
        if (error.code.startsWith("auth/")) {
          return {
            statusCode: 400,
            messages: {
              vi: `Lỗi xác thực: ${error.message || error.code}`,
              zh: `身份验证错误: ${error.message || error.code}`,
            },
          };
        }
    }
  }
  return null;
};
