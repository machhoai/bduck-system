"use client";

/**
 * Forbidden403 — Access denied page
 *
 * Shown when a user navigates to a page they don't have permission to access.
 * LUẬT THÉP: i18n (vi + zh), Light Theme only.
 */

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export default function Forbidden403() {
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            {/* Icon */}
            <div className="mb-4 flex h-8 w-12 items-center justify-center rounded-2xl bg-red-50">
                <ShieldAlert className="h-6 w-6 text-red-500" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-gray-900">
                {t.forbidden.title}
            </h1>

            {/* Description */}
            <p className="mt-2 w-full text-sm text-gray-500">
                {t.forbidden.description}
            </p>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex h-8 w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t.forbidden.goBack}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="h-8 w-fit rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                >
                    {t.forbidden.goHome}
                </button>
            </div>
        </div>
    );
}
