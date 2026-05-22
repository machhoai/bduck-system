'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../stores/useUserStore';
import { I18nProvider } from '../../lib/i18n';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import DashboardSkeleton from '../../components/layouts/DashboardSkeleton';

/**
 * Dashboard Group Layout — Auth Guard + Layout wrapper
 *
 * ► Kiểm tra isAuthenticated từ Zustand store
 * ► Nếu chưa login → redirect về /login
 * ► Nếu OK → render DashboardLayout + children
 * ► LUẬT THÉP: Dùng Skeleton loading thay vì spinner
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isMounted, isAuthenticated, router]);

  // Trước khi hydrate hoặc khi chưa auth → hiện skeleton
  if (!isMounted || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  return (
    <I18nProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </I18nProvider>
  );
}
