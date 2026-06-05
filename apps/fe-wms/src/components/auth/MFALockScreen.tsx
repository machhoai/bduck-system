import { useState, useEffect, useCallback } from "react";
import { useMFA } from "../../hooks/useMFA";
import { useUserStore } from "../../stores/useUserStore";
import { useTranslation } from "../../lib/i18n";
import { LockClosedIcon, EnvelopeIcon, KeyIcon } from "@heroicons/react/24/outline";
import { gooeyToast } from "goey-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export const MFALockScreen = () => {
    const { isLocked, unlockScreen } = useMFA();
    const { user } = useUserStore();
    const { t } = useTranslation();

    const [code, setCode] = useState("");
    const [method, setMethod] = useState<"totp" | "email">("totp");

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
                    if (!res.ok) throw new Error("Gửi email thất bại");
                    return res.json();
                }),
                {
                    loading: "Đang gửi mã OTP qua email...",
                    success: "Mã OTP đã được gửi đến email của bạn",
                    error: "Đã xảy ra lỗi khi gửi mã"
                }
            );
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;

        try {
            await gooeyToast.promise(
                fetch(`${API_BASE_URL}/api/auth/mfa/verify`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: code })
                }).then(async res => {
                    if (!res.ok) throw new Error("Mã không hợp lệ");
                    return res.json();
                }),
                {
                    loading: "Đang xác thực...",
                    success: () => {
                        unlockScreen();
                        setCode("");
                        return "Mở khóa thành công";
                    },
                    error: "Mã xác thực không đúng"
                }
            );
        } catch (error) {
            console.error(error);
        }
    };

    if (!isLocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col items-center border border-gray-100">
                <div className="bg-blue-50 p-4 rounded-full mb-6">
                    <LockClosedIcon className="w-8 h-8 text-blue-600" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Hệ thống đã khóa</h2>
                <p className="text-sm text-gray-500 text-center mb-6">
                    {method === "totp"
                        ? "Nhập mã từ ứng dụng Google Authenticator để tiếp tục."
                        : "Nhập mã OTP 6 số đã được gửi đến email của bạn để tiếp tục."}
                </p>

                <form onSubmit={handleVerify} className="w-full">
                    <input
                        type="text"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\\D/g, ''))}
                        placeholder="000000"
                        className="w-full text-center tracking-[0.5em] text-2xl font-mono h-12 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all mb-4"
                        autoFocus
                    />

                    <button
                        type="submit"
                        disabled={code.length !== 6}
                        className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                        Mở khóa
                    </button>
                </form>

                {user?.mfa_enabled && method === "totp" && (
                    <button
                        onClick={() => {
                            setMethod("email");
                            sendEmailOtp();
                        }}
                        className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-full p-2"
                    >
                        <EnvelopeIcon className="w-4 h-4" />
                        Sử dụng mã OTP qua Email
                    </button>
                )}

                {method === "email" && (
                    <button
                        onClick={sendEmailOtp}
                        className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors w-full p-2"
                    >
                        Gửi lại mã OTP
                    </button>
                )}
            </div>
        </div>
    );
};
