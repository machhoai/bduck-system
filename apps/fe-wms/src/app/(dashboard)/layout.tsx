"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "../../stores/useUserStore";
import { I18nProvider } from "../../lib/i18n";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import DashboardSkeleton from "../../components/layouts/DashboardSkeleton";
import { usePagePermission } from "../../hooks/usePagePermission";
import Forbidden403 from "../../components/shared/Forbidden403";
import { MFALockScreen } from "../../components/auth/MFALockScreen";
import { useMFA } from "../../hooks/useMFA";
import { useCurrentUserRoleSync } from "../../hooks/useCurrentUserRoleSync";
import GuideProvider from "../../components/providers/GuideProvider";

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
  const authStatus = useUserStore((s) => s.authStatus);
  const accessStatus = useUserStore((s) => s.accessStatus);
  const accessEpoch = useUserStore((s) => s.accessEpoch);
  const [isMounted, setIsMounted] = useState(false);
  const hasAccess = usePagePermission(pathname);
  const { isLocked } = useMFA();
  useCurrentUserRoleSync();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && authStatus === "SIGNED_OUT") {
      router.replace("/login");
    }
  }, [authStatus, isMounted, router]);

  // Trước khi hydrate hoặc khi chưa auth → hiện skeleton
  const isVerifyingAccess =
    accessStatus === "VERIFYING" || accessStatus === "OFFLINE_UNVERIFIED";
  const isVerifyingAuth =
    authStatus === "INITIALIZING" || authStatus === "VERIFYING";
  if (!isMounted || isVerifyingAuth || !isAuthenticated || isVerifyingAccess) {
    return <DashboardSkeleton />;
  }

  return (
    <I18nProvider>
      <MFALockScreen />
      <div
        key={accessEpoch}
        className={`h-full w-full transition-all duration-300 ${isLocked ? "blur-md pointer-events-none select-none" : ""}`}
      >
        <GuideProvider>
          <DashboardLayout>
            {hasAccess ? children : <Forbidden403 />}
          </DashboardLayout>
        </GuideProvider>
      </div>
    </I18nProvider>
  );
}
