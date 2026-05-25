"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";

export default function LoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const permissions = useUserStore((state) => state.permissions);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;

    const hasAnyRole = Object.keys(permissions).length > 0;
    router.push(hasAnyRole ? "/dashboard" : "/no-access");
  }, [isAuthenticated, permissions, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;
    await login(email, password);
  };

  return (
    <main className="min-h-screen bg-[var(--color-surface-base)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="hidden items-center justify-center bg-[var(--color-surface-elevated)] px-10 lg:flex">
          <div className="w-full max-w-[720px] space-y-8">
            <div className="inline-flex h-11 items-center gap-3 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] px-4 text-sm text-[var(--color-text-secondary)]">
              <Warehouse size={18} className="text-[var(--color-brand-primary)]" />
              {t.login.subtitle}
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-[56px] font-semibold leading-[1.07] tracking-[-0.28px] text-[var(--color-text-primary)]">
                {t.login.brand}
              </h1>
              <p className="mt-5 max-w-xl text-[24px] font-light leading-[1.5] text-[var(--color-text-secondary)]">
                {t.sidebar.moduleName}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              <span>{t.login.version}</span>
              <span className="h-3 w-px bg-[var(--color-border-subtle)]" />
              <span>v1.0.0</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:bg-[var(--color-surface-elevated)]">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 lg:hidden">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white">
                <Warehouse size={22} />
              </div>
              <h1 className="font-[var(--font-display)] text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)]">
                {t.login.brand}
              </h1>
              <p className="mt-2 text-[17px] text-[var(--color-text-muted)]">
                {t.login.subtitle}
              </p>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white lg:flex">
                <LockKeyhole size={20} />
              </div>
              <h2 className="font-[var(--font-display)] text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)]">
                {t.login.title}
              </h2>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-normal tracking-[-0.224px] text-[var(--color-text-muted)]">
                  {t.login.email}
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bduck.com"
                  className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-5 text-[17px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] disabled:opacity-40"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[14px] font-normal tracking-[-0.224px] text-[var(--color-text-muted)]">
                  {t.login.password}
                </span>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-5 pr-12 text-[17px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] disabled:opacity-40"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
                    aria-label={
                      showPassword ? t.login.hidePassword : t.login.showPassword
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-6 text-[17px] font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? t.login.authenticating : t.login.submit}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
