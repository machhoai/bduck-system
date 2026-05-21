'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Login Page — Client-Only Rendering
 *
 * LoginForm sử dụng Firebase Client SDK (auth), nên KHÔNG THỂ
 * pre-render/SSR lúc build time vì biến NEXT_PUBLIC_FIREBASE_*
 * chỉ tồn tại ở runtime (trong container hoặc browser).
 *
 * `ssr: false` đảm bảo toàn bộ Firebase chỉ được import ở browser.
 */
const LoginForm = dynamic(
  () => import('../../../components/auth/LoginForm'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Đang tải...</div>
      </div>
    ),
  }
);

export default function LoginPage() {
  return <LoginForm />;
}
