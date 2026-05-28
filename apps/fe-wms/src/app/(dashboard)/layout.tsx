"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "../../stores/useUserStore";
import { I18nProvider } from "../../lib/i18n";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import DashboardSkeleton from "../../components/layouts/DashboardSkeleton";
import { usePagePermission } from "../../hooks/usePagePermission";
import Forbidden403 from "../../components/shared/Forbidden403";

/**
 * Dashboard Group Layout — Auth Guard + RBAC Guard + Layout wrapper
 *
 * ► Kiểm tra isAuthenticated từ Zustand store
 * ► Nếu chưa login → redirect về /login
 * ► Nếu không có quyền → hiển thị trang 403
 * ► Nếu OK → render DashboardLayout + children
 * ► LUẬT THÉP: Dùng Skeleton loading thay vì spinner, RBAC check
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);
  const hasAccess = usePagePermission(pathname);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isMounted, isAuthenticated, router]);

  // Trước khi hydrate hoặc khi chưa auth → hiện skeleton
  if (!isMounted || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  return (
    <I18nProvider>
      <DashboardLayout>
        {hasAccess ? children : <Forbidden403 />}
      </DashboardLayout>
    </I18nProvider>
  );
}
