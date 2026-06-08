import { AuditAction, UserStatus } from "@bduck/shared-types";
import type { User } from "@bduck/shared-types";
import { createHash, randomBytes } from "crypto";
import { auth } from "../config/firebase.js";
import {
    ACCOUNT_INVITATION_PURPOSE,
    createAccountInvitation,
    findAccountInvitationByTokenHash,
    markAccountInvitationUsed,
    revokeAccountInvitation,
    revokeActiveAccountInvitations,
    type AccountInvitation,
} from "../repositories/accountInvitationRepository.js";
import { getUserById } from "../repositories/userRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { sendBrevoEmail } from "./brevoEmailService.js";

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

interface InvitationPublicInfo {
    email: string;
    full_name: string;
    expires_at: Date;
}

const invalidInvitationError = {
    statusCode: 404,
    messages: {
        vi: "Liên kết khởi tạo tài khoản không hợp lệ.",
        zh: "账户初始化链接无效。",
    },
};

const expiredInvitationError = {
    statusCode: 410,
    messages: {
        vi: "Liên kết khởi tạo tài khoản đã hết hạn. Vui lòng yêu cầu admin gửi lại.",
        zh: "账户初始化链接已过期。请联系管理员重新发送。",
    },
};

const usedInvitationError = {
    statusCode: 410,
    messages: {
        vi: "Liên kết khởi tạo tài khoản đã được sử dụng. Vui lòng đăng nhập hoặc yêu cầu admin gửi lại.",
        zh: "账户初始化链接已被使用。请登录或联系管理员重新发送。",
    },
};

const inactiveUserError = {
    statusCode: 403,
    messages: {
        vi: "Tài khoản chưa ở trạng thái hoạt động. Vui lòng liên hệ admin.",
        zh: "账户未处于启用状态。请联系管理员。",
    },
};

const passwordSchemaError = {
    statusCode: 400,
    messages: {
        vi: "Mật khẩu phải có ít nhất 8 ký tự và tối đa 128 ký tự.",
        zh: "密码长度必须为 8 到 128 个字符。",
    },
};

const createToken = () => randomBytes(32).toString("base64url");

const hashToken = (token: string) =>
    createHash("sha256").update(token, "utf8").digest("hex");

const toDate = (value: unknown): Date => {
    if (value instanceof Date) return value;
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
        return (value as { toDate: () => Date }).toDate();
    }
    return new Date(String(value));
};

const escapeHtml = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const getAppBaseUrl = () => {
    const explicitUrl =
        process.env.FE_WMS_APP_URL ||
        process.env.WMS_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL;
    if (explicitUrl) return explicitUrl.replace(/\/+$/, "");

    const firstCorsOrigin = process.env.BE_WMS_CORS_ORIGIN?.split(",")[0]?.trim();
    return (firstCorsOrigin || "http://app.wms.localhost").replace(/\/+$/, "");
};

const buildSetupUrl = (token: string) =>
    `${getAppBaseUrl()}/setup-password?token=${encodeURIComponent(token)}`;

const assertInvitationUsable = async (
    token: string,
): Promise<{ invitation: AccountInvitation; user: User }> => {
    const invitation = await findAccountInvitationByTokenHash(hashToken(token));
    if (!invitation || invitation.revoked_at) throw invalidInvitationError;
    if (invitation.used_at) throw usedInvitationError;

    const expiresAt = toDate(invitation.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw expiredInvitationError;
    }

    const user = await getUserById(invitation.user_id);
    if (!user || user.is_deleted) throw invalidInvitationError;
    if (user.status !== UserStatus.ACTIVE) throw inactiveUserError;

    return { invitation: { ...invitation, expires_at: expiresAt }, user };
};

export const sendInitialPasswordSetupInvitation = async (
    user: Pick<User, "id" | "email" | "full_name" | "status" | "is_deleted">,
    actorId: string,
    auditMetadata?: AuditMetadata,
): Promise<{ expires_at: Date }> => {
    if (user.is_deleted || user.status !== UserStatus.ACTIVE) {
        throw inactiveUserError;
    }

    await revokeActiveAccountInvitations(user.id, ACCOUNT_INVITATION_PURPOSE);

    const token = createToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await createAccountInvitation({
        user_id: user.id,
        token_hash: hashToken(token),
        purpose: ACCOUNT_INVITATION_PURPOSE,
        expires_at: expiresAt,
        created_by: actorId,
    });

    const setupUrl = buildSetupUrl(token);
    const safeName = escapeHtml(user.full_name);
    const safeEmail = escapeHtml(user.email);

    try {
        await sendBrevoEmail({
            to: [user.email],
            subject: "Kích hoạt tài khoản Joy World Cityfuns ERP",
            htmlContent: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Kích hoạt tài khoản Joy World Cityfuns ERP</h2>
          <p>Xin chào ${safeName},</p>
          <p>Tài khoản của bạn đã được tạo trên hệ thống Joy World Cityfuns ERP.</p>
          <p><strong>Email đăng nhập:</strong> ${safeEmail}</p>
          <p>
            <a href="${setupUrl}" style="display:inline-block;background:#f5a400;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">
              Đặt mật khẩu
            </a>
          </p>
          <p>Liên kết này có hiệu lực trong 24 giờ. Nếu liên kết hết hạn, vui lòng yêu cầu admin gửi lại.</p>
          <p>Nếu bạn không yêu cầu tài khoản này, vui lòng bỏ qua email.</p>
        </div>
      `,
            textContent: [
                `Xin chào ${user.full_name},`,
                "Tài khoản của bạn đã được tạo trên hệ thống Joy World Cityfuns ERP.",
                `Email đăng nhập: ${user.email}`,
                `Đặt mật khẩu tại: ${setupUrl}`,
                "Liên kết này có hiệu lực trong 24 giờ. Nếu liên kết hết hạn, vui lòng yêu cầu admin gửi lại.",
            ].join("\n"),
        });
    } catch (error) {
        await revokeAccountInvitation(invitation.id).catch(() => undefined);
        throw error;
    }

    await logAudit({
        entity_type: "account_invitations",
        entity_id: invitation.id,
        action: AuditAction.CREATE,
        user_id: actorId,
        old_value: null,
        new_value: {
            user_id: user.id,
            email: user.email,
            purpose: ACCOUNT_INVITATION_PURPOSE,
            expires_at: expiresAt.toISOString(),
        },
        ...auditMetadata,
    }).catch((auditError) => {
        console.error("[accountInvitationService] Failed to write audit log:", {
            invitationId: invitation.id,
            error: auditError,
        });
    });

    return { expires_at: expiresAt };
};

export const verifyAccountInvitation = async (
    token: string,
): Promise<InvitationPublicInfo> => {
    const { invitation, user } = await assertInvitationUsable(token);
    return {
        email: user.email,
        full_name: user.full_name,
        expires_at: invitation.expires_at,
    };
};

export const completeAccountInvitation = async (
    token: string,
    password: string,
): Promise<void> => {
    if (password.length < 8 || password.length > 128) {
        throw passwordSchemaError;
    }

    const { invitation, user } = await assertInvitationUsable(token);
    await auth.updateUser(user.id, {
        password,
        disabled: false,
    });
    await markAccountInvitationUsed(invitation.id);
};
