import { useState, useCallback } from "react";
import { LockClosedIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useUserStore } from "../../stores/useUserStore";
import { useTranslation } from "@/lib/i18n";
import { ACTION_OTP_TEXT } from "@/lib/i18n/componentTranslations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ActionOtpModalProps {
    onConfirm: (otp: string) => void;
    onCancel: () => void;
    title?: string;
    description?: string;
    isSubmitting?: boolean;
}

export function ActionOtpModal({
    onConfirm,
    onCancel,
    title,
    description,
    isSubmitting = false,
}: ActionOtpModalProps) {
    const { lang } = useTranslation();
    const copy = ACTION_OTP_TEXT[lang === "zh" ? "zh" : "vi"];
    const { user } = useUserStore();
    const [code, setCode] = useState("");
    const [method, setMethod] = useState<"totp" | "email">(user?.mfa_enabled ? "totp" : "email");

    const sendEmailOtp = useCallback(async () => {
        try {
            await gooeyToast.promise(
                fetch(`${API_BASE_URL}/api/auth/mfa/send-email`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                }).then(async (res) => {
                    if (!res.ok) throw new Error(copy.sendEmailFailed);
                    return res.json();
                }),
                {
                    loading: copy.sendingEmailOtp,
                    success: copy.emailOtpSent,
                    error: copy.sendOtpError,
                }
            );
        } catch (e) {
            console.error(e);
        }
    }, [copy]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;
        onConfirm(code);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-[calc(100%-2rem)] max-w-4xl rounded-2xl bg-white p-6 shadow-xl relative">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                        <LockClosedIcon className="h-6 w-6 text-blue-600" />
                    </div>

                    <h3 className="mb-2 text-lg font-bold text-gray-900">{title ?? copy.title}</h3>
                    <p className="mb-6 text-sm text-gray-500">{description ?? copy.description}</p>

                    <form onSubmit={handleSubmit} className="w-full">
                        <input
                            type="text"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="000000"
                            disabled={isSubmitting}
                            className="mb-4 h-12 w-full rounded-lg border border-gray-200 bg-gray-50 text-center font-mono text-2xl tracking-[0.5em] text-gray-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            autoFocus
                        />

                        <button
                            type="submit"
                            disabled={code.length !== 6 || isSubmitting}
                            className="flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
                        >
                            {isSubmitting ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                copy.confirm
                            )}
                        </button>
                    </form>

                    {user?.mfa_enabled && method === "totp" && (
                        <button
                            onClick={() => {
                                setMethod("email");
                                sendEmailOtp();
                            }}
                            disabled={isSubmitting}
                            className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 transition-colors hover:text-blue-600 disabled:opacity-50"
                        >
                            <EnvelopeIcon className="h-4 w-4" />
                            {copy.sendEmailOtp}
                        </button>
                    )}

                    {method === "email" && (
                        <button
                            onClick={sendEmailOtp}
                            disabled={isSubmitting}
                            className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 transition-colors hover:text-blue-600 disabled:opacity-50"
                        >
                            {copy.resendEmailOtp}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
