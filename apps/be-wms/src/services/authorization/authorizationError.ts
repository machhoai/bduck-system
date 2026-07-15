export interface LocalizedAuthorizationMessages {
  vi: string;
  zh: string;
}

export type AuthorizationErrorCode =
  | "AUTHORIZATION_ACTOR_REQUIRED"
  | "AUTHORIZATION_ACTOR_INACTIVE"
  | "AUTHORIZATION_WORKPLACE_REQUIRED"
  | "AUTHORIZATION_WORKPLACE_INVALID"
  | "AUTHORIZATION_SOURCE_INVALID"
  | "AUTHORIZATION_DENIED";

const ERROR_MESSAGES: Record<
  AuthorizationErrorCode,
  LocalizedAuthorizationMessages
> = {
  AUTHORIZATION_ACTOR_REQUIRED: {
    vi: "Không tìm thấy tài khoản đã xác thực.",
    zh: "未找到已认证的用户账户。",
  },
  AUTHORIZATION_ACTOR_INACTIVE: {
    vi: "Tài khoản không còn hoạt động hoặc đã bị xóa.",
    zh: "用户账户未启用或已被删除。",
  },
  AUTHORIZATION_WORKPLACE_REQUIRED: {
    vi: "Tài khoản chưa được gán cơ sở làm việc.",
    zh: "用户账户尚未分配工作场所。",
  },
  AUTHORIZATION_WORKPLACE_INVALID: {
    vi: "Cơ sở làm việc không tồn tại hoặc không còn hoạt động.",
    zh: "工作场所不存在或未启用。",
  },
  AUTHORIZATION_SOURCE_INVALID: {
    vi: "Dữ liệu nguồn phân quyền không hợp lệ.",
    zh: "授权源数据无效。",
  },
  AUTHORIZATION_DENIED: {
    vi: "Bạn không có quyền thực hiện thao tác trong phạm vi cơ sở này.",
    zh: "您无权在此场所范围内执行该操作。",
  },
};

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly statusCode: number;
  readonly messages: LocalizedAuthorizationMessages;

  constructor(code: AuthorizationErrorCode, statusCode = 403) {
    const messages = ERROR_MESSAGES[code];
    super(messages.vi);
    this.name = "AuthorizationError";
    this.code = code;
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

export const authorizationError = (
  code: AuthorizationErrorCode,
): AuthorizationError =>
  new AuthorizationError(
    code,
    code === "AUTHORIZATION_ACTOR_REQUIRED" ? 401 : 403,
  );
