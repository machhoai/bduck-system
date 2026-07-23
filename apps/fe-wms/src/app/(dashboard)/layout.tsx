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
import { resolveDashboardRuntimeFailure } from "../../lib/authNavigationPolicy";

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
    const runtimeFailure = resolveDashboardRuntimeFailure(authStatus, accessStatus);
    if (runtimeFailure) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
                <div className="w-full sm:max-w-80 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h1 className="text-lg font-semibold text-slate-900">
                        {runtimeFailure.title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        {runtimeFailure.description}
                    </p>
                    <div className="mt-5 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Thử lại
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace("/login")}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Đăng nhập lại
                        </button>
                    </div>
                </div>
            </div>
        );
    }
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
