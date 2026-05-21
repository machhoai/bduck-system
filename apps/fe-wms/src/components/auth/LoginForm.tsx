'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUserStore } from '../../stores/useUserStore';
import { useRouter } from 'next/navigation';

/**
 * LoginForm — Industrial Luxury Aesthetic
 *
 * Design Direction: Dark industrial luxury with B.Duck Yellow accent
 * DFII Score: 13 (Impact:4 + Fit:5 + Feasibility:4 + Performance:4 − Risk:4)
 * Differentiation: "This avoids generic white-card-on-gray login by using
 * a dark split-panel with animated gradient orb and brand-yellow CTA."
 */
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login, isLoading } = useAuth();

  const isAuthenticated = useUserStore(state => state.isAuthenticated);
  const permissions = useUserStore(state => state.permissions);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const hasAnyRole = Object.keys(permissions).length > 0;
      if (!hasAnyRole) {
        router.push('/no-access');
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, permissions, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-surface-base)]">

      {/* ── Left Panel: Brand Visual ── */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-end">
        {/* Animated gradient orb */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, #F5C518 0%, #F59E18 40%, transparent 70%)',
            animation: mounted ? 'float 8s ease-in-out infinite' : 'none',
          }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 max-w-full">

          <h1
            className="text-[5.75rem] text-right font-bold leading-[1.1] tracking-tight mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            <span style={{ color: 'var(--color-brand-primary)' }}>Joy World <br /> Cityfuns</span>
            <br />
            WMS
          </h1>

          {/* Status indicators */}
          <div className="mt-1 flex items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Phiên bản</span>
            </div>
            <div className="w-px h-3 bg-[var(--color-border-subtle)]" />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>v1.0.0</span>
            <div className="w-2 h-2 rounded-full bg-[var(--color-accent-success)] animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-20">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand header */}
          <div className="lg:hidden mb-2 flex items-center gap-3">
            <div className="relative z-10 max-w-full">

              <h1
                className="text-[4.75rem] font-bold leading-[1.1] tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                <span style={{ color: 'var(--color-brand-primary)' }}>Joy World <br /> Cityfuns</span>
                <br />
                WMS
              </h1>

              {/* Status indicators */}
              <div className=" mb-1 flex items-center justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Phiên bản</span>
                </div>
                <div className="w-px h-3 bg-[var(--color-border-subtle)]" />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>v1.0.0</span>
              </div>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-2">
            <h2
              className="text-5xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              Đăng nhập
            </h2>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email field */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Email
              </label>
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
                className="w-full h-12 px-4 rounded-[var(--radius-md)] text-sm transition-all duration-200 outline-none disabled:opacity-40"
                style={{
                  background: 'var(--color-surface-input)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-border-focus)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-brand-primary-muted)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-subtle)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-[var(--radius-md)] text-sm transition-all duration-200 outline-none disabled:opacity-40"
                  style={{
                    background: 'var(--color-surface-input)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-border-focus)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-brand-primary-muted)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-subtle)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--color-border-subtle)]"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-[var(--radius-md)] text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: isLoading ? 'var(--color-brand-primary-hover)' : 'var(--color-brand-primary)',
                color: '#0A0A0F',
                fontFamily: 'var(--font-display)',
                boxShadow: isLoading ? 'none' : '0 0 20px var(--color-brand-primary-muted)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--color-brand-primary-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 24px var(--color-brand-primary-muted)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--color-brand-primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 0 20px var(--color-brand-primary-muted)';
                }
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang xác thực...
                </span>
              ) : (
                'Đăng nhập hệ thống'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 pt-6">
            <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              Liên hệ Admin nếu bạn chưa có tài khoản
            </p>
          </div>
        </div>
      </div>

      {/* ── Keyframe animation ── */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        input::placeholder {
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
