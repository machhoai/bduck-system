"use client";

import { useEffect, useMemo, useState } from "react";
import {
    BadgeCheck,
    Boxes,
    CreditCard,
    FileSearch,
    KeyRound,
    Loader2,
    PackageSearch,
    Play,
    ReceiptText,
    Search,
    ServerCog,
    Ticket,
    UserRoundSearch,
} from "lucide-react";

type Preset = {
    id: string;
    label: string;
    action: string;
    version: string;
    body: Record<string, unknown>;
    icon: typeof Search;
};

type TesterResponse = {
    success?: boolean;
    status?: number;
    statusText?: string;
    durationMs?: number;
    endpoint?: string;
    signedPayload?: Record<string, unknown>;
    response?: unknown;
    message?: string;
};

const presets: Preset[] = [
    {
        id: "sell-goods-ticket",
        label: "Danh sách vé",
        action: "setmeal_getsellgoods",
        version: "11.7.1",
        body: { SetmealName: "", TypeId: "", Category: "4" },
        icon: Ticket,
    },
    {
        id: "passticket-list",
        label: "Danh sách gói vé",
        action: "setmeal_passticket_list",
        version: "11.7.1",
        body: { category: 4, subCategory: 1, page: 1, limit: 20 },
        icon: PackageSearch,
    },
    {
        id: "subscribe-base-list",
        label: "Gói đặt chỗ",
        action: "oversea_subscribe_base_list",
        version: "11.7.1",
        body: { page: 1, limit: 20 },
        icon: Boxes,
    },
    {
        id: "gift-type",
        label: "Nhóm lưu niệm",
        action: "gift_type",
        version: "10.11.8",
        body: {},
        icon: BadgeCheck,
    },
    {
        id: "gift-stock",
        label: "Hàng lưu niệm",
        action: "gift_realtime_stock",
        version: "10.11.8",
        body: {
            typeId: "",
            giftName: "",
            giftNo: "",
            stockId: "",
            isFilterZero: false,
        },
        icon: Boxes,
    },
    {
        id: "addon-goods",
        label: "Hàng add-on",
        action: "oversea_goodsmanage_list",
        version: "11.7.1",
        body: { categoryGroupId: "" },
        icon: PackageSearch,
    },
    {
        id: "member-card",
        label: "TV theo số thẻ",
        action: "member_getmember_membercode",
        version: "10.11.8",
        body: { memberCode: "" },
        icon: UserRoundSearch,
    },
    {
        id: "member-serial",
        label: "TV theo serial",
        action: "member_getmember_serialnumber",
        version: "10.11.8",
        body: { serialNumber: "" },
        icon: UserRoundSearch,
    },
    {
        id: "order-precalculate",
        label: "Tính trước đơn",
        action: "order_precalculate",
        version: "11.7.1",
        body: {
            Uid: "",
            GoodsItems: [{ GoodsId: "", Quantity: 1 }],
        },
        icon: FileSearch,
    },
    {
        id: "order-create",
        label: "Tạo đơn hàng",
        action: "order_create",
        version: "11.7.1",
        body: {
            Uid: "",
            GoodsItems: [{ GoodsId: "", Quantity: 1 }],
        },
        icon: ReceiptText,
    },
    {
        id: "order-pay",
        label: "Thanh toán",
        action: "order_pay",
        version: "11.7.1",
        body: { OrderNumber: "", PayAmount: null },
        icon: CreditCard,
    },
    {
        id: "order-pay-query",
        label: "Trạng thái thanh toán",
        action: "order_pay_query",
        version: "11.7.1",
        body: { OrderNumber: "" },
        icon: Search,
    },
];

function prettyJson(value: unknown) {
    return JSON.stringify(value, null, 2);
}

function readStorage(key: string, fallback: string) {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) ?? fallback;
}

export default function OpenApiTesterPage() {
    const [baseUrl, setBaseUrl] = useState("http://global.dev.jingjianx.vip");
    const [appId, setAppId] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [signMode, setSignMode] = useState<"withSecret" | "withoutSecret">("withSecret");
    const [activePresetId, setActivePresetId] = useState(presets[0].id);
    const [action, setAction] = useState(presets[0].action);
    const [version, setVersion] = useState(presets[0].version);
    const [bodyText, setBodyText] = useState(prettyJson(presets[0].body));
    const [result, setResult] = useState<TesterResponse | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const activePreset = useMemo(
        () => presets.find((preset) => preset.id === activePresetId) ?? presets[0],
        [activePresetId],
    );

    useEffect(() => {
        setBaseUrl(readStorage("openapiTester.baseUrl", "http://global.dev.jingjianx.vip"));
        setAppId(readStorage("openapiTester.appId", ""));
        setSecretKey(readStorage("openapiTester.secretKey", ""));
    }, []);

    useEffect(() => {
        window.localStorage.setItem("openapiTester.baseUrl", baseUrl);
        window.localStorage.setItem("openapiTester.appId", appId);
        window.localStorage.setItem("openapiTester.secretKey", secretKey);
    }, [baseUrl, appId, secretKey]);

    const applyPreset = (preset: Preset) => {
        setActivePresetId(preset.id);
        setAction(preset.action);
        setVersion(preset.version);
        setBodyText(prettyJson(preset.body));
        setResult(null);
        setError("");
    };

    const sendRequest = async () => {
        setLoading(true);
        setError("");
        setResult(null);

        let parsedBody: unknown;

        try {
            parsedBody = bodyText.trim() ? JSON.parse(bodyText) : {};
        } catch (jsonError) {
            setLoading(false);
            setError(jsonError instanceof Error ? jsonError.message : "JSON body khong hop le.");
            return;
        }

        try {
            const response = await fetch("/api/openapi-tester", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl,
                    appId,
                    secretKey,
                    signMode,
                    version,
                    action,
                    body: parsedBody,
                }),
            });

            const data = (await response.json()) as TesterResponse;
            setResult(data);
            if (!response.ok) {
                setError(data.message || "Request failed.");
            }
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Request failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
            <section className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase text-[var(--color-text-muted)]">
                                Jingjian OpenAPI
                            </p>
                            <h1 className="mt-1 font-[var(--font-display)] text-xl font-semibold tracking-normal">
                                API Test Console
                            </h1>
                        </div>
                        <button
                            type="button"
                            onClick={sendRequest}
                            disabled={loading}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            Send
                        </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            Base URL
                            <input
                                value={baseUrl}
                                onChange={(event) => setBaseUrl(event.target.value)}
                                className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-border-focus)]"
                                placeholder="https://example.com"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            AppId
                            <input
                                value={appId}
                                onChange={(event) => setAppId(event.target.value)}
                                className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-border-focus)]"
                                placeholder="AppId"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            Secret Key
                            <input
                                value={secretKey}
                                onChange={(event) => setSecretKey(event.target.value)}
                                className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-border-focus)]"
                                placeholder="Secret key"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                            Sign mode
                        </span>
                        <button
                            type="button"
                            onClick={() => setSignMode("withSecret")}
                            className={`h-9 rounded-md border px-3 text-sm font-medium ${
                                signMode === "withSecret"
                                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary-dark)]"
                                    : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                            }`}
                        >
                            With secret
                        </button>
                        <button
                            type="button"
                            onClick={() => setSignMode("withoutSecret")}
                            className={`h-9 rounded-md border px-3 text-sm font-medium ${
                                signMode === "withoutSecret"
                                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary-dark)]"
                                    : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                            }`}
                        >
                            Without secret
                        </button>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
                <aside className="flex flex-col gap-2">
                    {presets.map((preset) => {
                        const Icon = preset.icon;
                        const isActive = preset.id === activePreset.id;

                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className={`flex h-11 items-center gap-3 rounded-md border px-3 text-left text-sm font-medium transition ${isActive
                                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary-dark)]"
                                        : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]"
                                    }`}
                            >
                                <Icon size={17} />
                                <span className="truncate">{preset.label}</span>
                            </button>
                        );
                    })}
                </aside>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <section className="rounded-md border border-[var(--color-border-subtle)] bg-white p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <ServerCog size={18} className="text-[var(--color-brand-primary)]" />
                            <h2 className="text-base font-semibold tracking-normal">Request</h2>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                            <label className="flex flex-col gap-1 text-sm font-medium">
                                Action
                                <input
                                    value={action}
                                    onChange={(event) => setAction(event.target.value)}
                                    className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-medium">
                                Version
                                <input
                                    value={version}
                                    onChange={(event) => setVersion(event.target.value)}
                                    className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </label>
                        </div>

                        <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
                            Business Body
                            <textarea
                                value={bodyText}
                                onChange={(event) => setBodyText(event.target.value)}
                                spellCheck={false}
                                className="min-h-[310px] resize-y rounded-md border border-[var(--color-border-subtle)] bg-[#fbfbfd] p-3 font-mono text-xs font-normal leading-5 outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </label>

                        {error && (
                            <div className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
                                {error}
                            </div>
                        )}
                    </section>

                    <section className="rounded-md border border-[var(--color-border-subtle)] bg-white p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <KeyRound size={18} className="text-[var(--color-brand-primary)]" />
                                <h2 className="text-base font-semibold tracking-normal">Signed Payload</h2>
                            </div>
                            {result?.status && (
                                <span
                                    className={`rounded-md px-2 py-1 text-xs font-semibold ${result.success
                                            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                            : "bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
                                        }`}
                                >
                                    {result.status} {result.durationMs ?? 0}ms
                                </span>
                            )}
                        </div>

                        <pre className="max-h-[230px] overflow-auto rounded-md border border-[var(--color-border-subtle)] bg-[#fbfbfd] p-3 font-mono text-xs leading-5">
                            {result?.signedPayload ? prettyJson(result.signedPayload) : "{}"}
                        </pre>

                        <div className="mt-4 flex items-center gap-2">
                            <ReceiptText size={18} className="text-[var(--color-brand-primary)]" />
                            <h2 className="text-base font-semibold tracking-normal">Response</h2>
                        </div>
                        <pre className="mt-3 max-h-[410px] overflow-auto rounded-md border border-[var(--color-border-subtle)] bg-[#fbfbfd] p-3 font-mono text-xs leading-5">
                            {result ? prettyJson(result.response ?? result) : "{}"}
                        </pre>
                    </section>
                </div>
            </section>
        </main>
    );
}
