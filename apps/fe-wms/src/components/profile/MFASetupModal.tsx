import { useState } from "react";
import { useUserStore } from "../../stores/useUserStore";
import { gooeyToast } from "goey-toast";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "@/lib/i18n";
import { MFA_SETUP_TEXT } from "@/lib/i18n/componentTranslations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export const MFASetupModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { lang } = useTranslation();
    const copy = MFA_SETUP_TEXT[lang === "zh" ? "zh" : "vi"];
    const { user } = useUserStore();
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"start" | "scan" | "verify">("start");
    const [isLoading, setIsLoading] = useState(false);

    const handleStartSetup = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/mfa/setup`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            });
            const { data } = await response.json();
            setQrCodeUrl(data.qrCodeUrl);
            setSecret(data.secret);
            setStep("scan");
        } catch (e) {
            gooeyToast.error(copy.setupLoadError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;

        try {
            await gooeyToast.promise(
                fetch(`${API_BASE_URL}/api/auth/mfa/verify-setup`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: code, secret })
                }).then(async res => {
                    if (!res.ok) throw new Error(copy.invalidCode);
                    return res.json();
                }),
                {
                    loading: copy.verifying,
                    success: () => {
                        if (user) {
                            // Update local state optimistic
                            useUserStore.setState({ user: { ...user, mfa_enabled: true } });
                        }
                        setTimeout(onClose, 500);
                        return copy.linked;
                    },
                    error: copy.invalidConfirmCode
                }
            );
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {copy.title}
                </h2>

                {step === "start" && (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600">
                            {copy.intro}
                        </p>
                        <button
                            onClick={handleStartSetup}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
                        >
                            {copy.start}
                        </button>
                    </div>
                )}

                {step === "scan" && qrCodeUrl && (
                    <div className="flex flex-col gap-4 items-center">
                        <p className="text-sm text-gray-600 text-center">
                            {copy.scanInstruction.split("\n").map((line) => (
                                <span key={line}>
                                    {line}
                                    <br />
                                </span>
                            ))}
                        </p>
                        <div className="bg-gray-100 p-2 rounded-lg">
                            <img src={qrCodeUrl} alt={copy.qrAlt} className="w-48 h-48" />
                        </div>
                        <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                            {copy.backupKey} {secret}
                        </p>
                        <button
                            onClick={() => setStep("verify")}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors mt-2"
                        >
                            {copy.continue}
                        </button>
                    </div>
                )}

                {step === "verify" && (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600 text-center">
                            {copy.verifyInstruction}
                        </p>
                        <form onSubmit={handleVerify} className="w-full flex flex-col gap-4">
                            <input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\\D/g, ''))}
                                placeholder="000000"
                                className="w-full text-center tracking-[0.5em] text-2xl font-mono h-12 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={code.length !== 6}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg transition-colors"
                            >
                                {copy.confirm}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
