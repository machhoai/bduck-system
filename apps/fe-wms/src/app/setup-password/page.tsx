"use client";

import { AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { getLocalizedMessage } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  messages?: {
    vi?: string;
    zh?: string;
  };
}

interface InvitationInfo {
  email: string;
  full_name: string;
  expires_at: string;
  purpose?: string;
}

type PageState = "loading" | "valid" | "invalid" | "success";

export default function SetupPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [purpose, setPurpose] = useState("");
  const isPasswordReset = purpose === "reset";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentToken = params.get("token");
    const currentPurpose = params.get("purpose");

    if (!currentToken) {
      setPageState("invalid");
      setMessage("Liên kết không hợp lệ.");
      return;
    }

    setToken(currentToken);
    setPurpose(currentPurpose || "");
    void verifyInvitation(currentToken);
  }, []);

  const passwordError = useMemo(() => {
    if (!password && !confirmPassword) return "";
    if (password.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
    if (password.length > 128) return "Mật khẩu không được vượt quá 128 ký tự.";
    if (confirmPassword && password !== confirmPassword) {
      return "Mật khẩu xác nhận chưa khớp.";
    }
    return "";
  }, [confirmPassword, password]);

  const usernameError = useMemo(() => {
    if (isPasswordReset || !username) return "";
    if (username.trim().length < 3) {
      return "Tên đăng nhập phải có ít nhất 3 ký tự.";
    }
    if (username.trim().length > 80) {
      return "Tên đăng nhập không được vượt quá 80 ký tự.";
    }
    return "";
  }, [isPasswordReset, username]);

  const verifyInvitation = async (currentToken: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/account-invitations/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: currentToken }),
        },
      );
      const body = (await response
        .json()
        .catch(() => null)) as ApiResponse<InvitationInfo> | null;

      if (!response.ok || !body?.success || !body.data) {
        throw new Error(
          getLocalizedMessage(body?.messages) ||
            "Liên kết đã hết hạn hoặc không còn hiệu lực.",
        );
      }

      setPurpose(
        body.data.purpose === "PASSWORD_RESET" ? "reset" : "setup",
      );
      setInvitation(body.data);
      setPageState("valid");
      setMessage("");
    } catch (error) {
      setPageState("invalid");
      setMessage(
        error instanceof Error
          ? error.message
          : "Liên kết đã hết hạn hoặc không còn hiệu lực.",
      );
    }
  };

  const completeInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (
      passwordError ||
      usernameError ||
      (!isPasswordReset && !username.trim()) ||
      !password ||
      !confirmPassword
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/account-invitations/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password,
            ...(!isPasswordReset ? { username: username.trim() } : {}),
          }),
        },
      );
      const body = (await response
        .json()
        .catch(() => null)) as ApiResponse<null> | null;

      if (!response.ok || !body?.success) {
        throw new Error(
          getLocalizedMessage(body?.messages) ||
            "Không thể đặt mật khẩu. Vui lòng yêu cầu admin gửi lại liên kết.",
        );
      }

      setPageState("success");
      setMessage(
        getLocalizedMessage(body?.messages) || "Đã đặt mật khẩu thành công.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể đặt mật khẩu. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const expiresAt = invitation?.expires_at
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(invitation.expires_at))
    : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface-base)] px-4 py-10">
      <section className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
            {pageState === "success" ? (
              <CheckCircle2 size={22} />
            ) : pageState === "invalid" ? (
              <AlertCircle size={22} />
            ) : (
              <LockKeyhole size={22} />
            )}
          </span>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {purpose === "reset" ? "Đặt lại mật khẩu" : "Khởi tạo tài khoản"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Joy World Cityfuns WMS
            </p>
          </div>
        </div>

        {pageState === "loading" && (
          <div className="space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-surface-card)]" />
            <div className="h-10 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-card)]" />
          </div>
        )}

        {pageState === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {message}
            </p>
            <a
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white"
            >
              Về trang đăng nhập
            </a>
          </div>
        )}

        {pageState === "valid" && invitation && (
          <form className="space-y-4" onSubmit={completeInvitation}>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3 text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">
                {invitation.full_name}
              </p>
              <p>{invitation.email}</p>
              {expiresAt && <p>Hết hạn: {expiresAt}</p>}
            </div>

            {!isPasswordReset && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                  Tên đăng nhập
                </span>
                <input
                  type="text"
                  minLength={3}
                  maxLength={80}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setMessage("");
                  }}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                Mật khẩu mới
              </span>
              <input
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
                Xác nhận mật khẩu
              </span>
              <input
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </label>

            {(usernameError || passwordError || message) && (
              <p className="text-sm leading-6 text-[var(--color-accent-error)]">
                {usernameError || passwordError || message}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                Boolean(usernameError) ||
                Boolean(passwordError) ||
                (!isPasswordReset && !username.trim()) ||
                !password ||
                !confirmPassword
              }
              className="h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting
                ? "Đang khởi tạo tài khoản..."
                : isPasswordReset
                  ? "Đặt lại mật khẩu"
                  : "Tạo tên đăng nhập và mật khẩu"}
            </button>
          </form>
        )}

        {pageState === "success" && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {message}
            </p>
            <a
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white"
            >
              Đăng nhập
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
