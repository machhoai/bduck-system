import { useState, useEffect, useCallback } from "react";
import { useMFA } from "../../hooks/useMFA";
import { useUserStore } from "../../stores/useUserStore";
import { useTranslation } from "../../lib/i18n";
import { useAuth } from "../../hooks/useAuth";
import { LockClosedIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { LogOut, Globe } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { MFA_LOCK_TEXT } from "../../lib/i18n/componentTranslations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (name: string) => {
    const colors = [
        "bg-[#0066cc10] text-[#0066cc]",
        "bg-[#257a3e10] text-[#257a3e]",
        "bg-[#93600010] text-[#936000]",
        "bg-[#7928ca10] text-[#7928ca]",
        "bg-[#ff007f10] text-[#ff007f]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const maskEmail = (email?: string) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    if (!domain) return email;
    if (username.length <= 4) {
        return `${username[0]}***${username[username.length - 1]}@${domain}`;
    }
    const start = username.slice(0, Math.min(3, Math.floor(username.length / 2)));
    const end = username.slice(-Math.min(3, Math.floor(username.length / 2)));
    return `${start}***${end}@${domain}`;
};

export const MFALockScreen = () => {
    const { isLocked, unlockScreen } = useMFA();
    const { user } = useUserStore();
    const { lang, setLang } = useTranslation();
    const { logout } = useAuth();
    const copy = MFA_LOCK_TEXT[lang === "zh" ? "zh" : "vi"];

    const [code, setCode] = useState("");
    const [method, setMethod] = useState<"totp" | "email">("totp");
    const [isFocused, setIsFocused] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (isLocked && user) {
            if (user.mfa_enabled) {
                setMethod("totp");
            } else {
                setMethod("email");
                sendEmailOtp();
            }
        }
    }, [isLocked, user]);

    const sendEmailOtp = useCallback(async () => {
        try {
            await gooeyToast.promise(
                fetch(`${API_BASE_URL}/api/auth/mfa/send-email`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" }
                }).then(async res => {
                    if (!res.ok) throw new Error(copy.sendEmailFailed);
                    return res.json();
                }),
                {
                    loading: copy.sendingEmailOtp,
                    success: copy.emailOtpSent,
                    error: copy.sendOtpError
                }
            );
        } catch (e) {
            console.error(e);
        }
    }, [copy]);

    const verifyCode = async (token: string) => {
        if (isValidating) return;
        setIsValidating(true);
        try {
            await gooeyToast.promise(
                fetch(`${API_BASE_URL}/api/auth/mfa/verify`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token })
                }).then(async res => {
                    if (!res.ok) throw new Error(copy.invalidCode);
                    return res.json();
                }),
                {
                    loading: copy.verifying,
                    success: () => {
                        unlockScreen();
                        setCode("");
                        setIsValidating(false);
                        return copy.unlockSuccess;
                    },
                    error: () => {
                        setCode("");
                        setIsValidating(false);
                        return copy.verifyError;
                    }
                }
            );
        } catch (error) {
            console.error(error);
            setCode("");
            setIsValidating(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;
        void verifyCode(code);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
        setCode(val);
        if (val.length === 6) {
            void verifyCode(val);
        }
    };

    const toggleLanguage = () => {
        setLang(lang === "vi" ? "zh" : "vi");
    };

    if (!isLocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/35 backdrop-blur-md">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col items-center border border-[var(--color-border-soft)] relative">
                {/* Top Actions: Language Switch & Logout */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleLanguage}
                        title={copy.changeLanguage}
                        className="flex h-7 px-2.5 items-center justify-center gap-1 rounded-full border border-[var(--color-border-subtle)] hover:bg-slate-50 text-xxs font-bold text-[var(--color-text-secondary)] transition-all cursor-pointer"
                    >
                        <Globe size={12} />
                        <span>{lang === "vi" ? "ZH" : "VI"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void logout()}
                        title={copy.logout}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[#b42318] hover:bg-[#b4231808] transition-all cursor-pointer"
                    >
                        <LogOut size={12} />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-5 w-full">
                    {user ? (
                        <>
                            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold mb-3 shadow-inner ${getAvatarBg(user.full_name || "")}`}>
                                {getInitials(user.full_name || "")}
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {user.full_name}
                            </h3>
                            <p className="text-xxs text-[var(--color-text-muted)] mt-0.5 font-mono">
                                {user.employee_id}
                            </p>
                        </>
                    ) : (
                        <div className="bg-blue-50 p-4 rounded-full mb-3">
                            <LockClosedIcon className="w-8 h-8 text-blue-600" />
                        </div>
                    )}
                </div>

                <p className="text-xs text-[var(--color-text-muted)] text-center mb-6 px-2 leading-relaxed">
                    {method === "totp" ? (
                        copy.totpInstruction
                    ) : (
                        <>
                            {copy.emailInstruction}
                            {user?.email && (
                                <span className="block mt-1.5 font-semibold text-[var(--color-text-secondary)] font-mono text-[11px]">
                                    {maskEmail(user.email)}
                                </span>
                            )}
                        </>
                    )}
                </p>

                <form onSubmit={handleVerify} className="w-full max-w-[320px]">
                    <div className="relative w-full flex flex-col items-center mb-6">
                        {/* Hidden input overlaying the container to catch focus and click events */}
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={6}
                            value={code}
                            onChange={handleInputChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                            disabled={isValidating}
                            autoFocus
                        />
                        
                        {/* 6 Visual styled boxes */}
                        <div className="flex gap-2.5 justify-center w-full">
                            {Array.from({ length: 6 }).map((_, index) => {
                                const char = code[index] || "";
                                const isActive = isFocused && (index === code.length || (index === 5 && code.length === 6));
                                return (
                                    <div
                                        key={index}
                                        className={`w-11 h-12 rounded-xl border flex items-center justify-center text-xl font-bold font-mono transition-all duration-200 ${
                                            char
                                                ? "border-[var(--color-brand-primary)] bg-white text-[var(--color-text-primary)]"
                                                : "border-[var(--color-border-subtle)] bg-slate-50/50 text-[var(--color-text-muted)]"
                                        } ${
                                            isActive
                                                ? "ring-2 ring-[var(--color-brand-primary-muted)] border-[var(--color-brand-primary)] scale-105 bg-white"
                                                : ""
                                        }`}
                                    >
                                        {char}
                                        {/* Blinking caret when active and empty */}
                                        {isActive && char === "" && (
                                            <span className="w-0.5 h-5 bg-[var(--color-brand-primary)] animate-pulse" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={code.length !== 6 || isValidating}
                        className="w-full h-10 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-full font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                    >
                        {copy.unlock}
                    </button>
                </form>

                {user?.mfa_enabled && method === "totp" && (
                    <button
                        type="button"
                        onClick={() => {
                            setMethod("email");
                            sendEmailOtp();
                        }}
                        className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors w-full p-2 font-medium cursor-pointer"
                    >
                        <EnvelopeIcon className="w-4 h-4" />
                        {copy.useEmailOtp}
                    </button>
                )}

                {method === "email" && (
                    <button
                        type="button"
                        onClick={sendEmailOtp}
                        className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors w-full p-2 font-medium cursor-pointer"
                    >
                        {copy.resendOtp}
                    </button>
                )}
            </div>
        </div>
    );
};
