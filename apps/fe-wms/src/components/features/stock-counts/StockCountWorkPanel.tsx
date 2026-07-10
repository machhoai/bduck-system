"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Package, RotateCcw, Save, X, Warehouse, Minus, Plus, Check } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import type { StockCountDetail, StockCountItemRow, UpdateStockCountItemPayload } from "@/api/stockCountApi";

type Lang = "vi" | "zh";

const reasonOptions = ["MISSING", "DAMAGED", "EXPIRED", "WRONG_LOCATION", "OTHER"] as const;

interface StockCountWorkPanelProps {
    lang: Lang;
    detail: StockCountDetail | null;
    loading?: boolean;
    isSubmitting: boolean;
    onSaveItem: (itemId: string, payload: UpdateStockCountItemPayload) => Promise<unknown>;
    onSubmitSession: () => Promise<unknown>;
    onCloseMobile?: () => void;
}

function formatQty(value: number | null | undefined) {
    return typeof value === "number" ? value.toLocaleString("vi-VN") : "-";
}

function getProgress(items: StockCountItemRow[]) {
    const counted = items.filter((item) => item.counted_quantity !== null && item.counted_quantity !== undefined).length;
    const issues = items.filter((item) => item.has_discrepancy).length;
    return { counted, total: items.length, issues };
}

export function StockCountWorkPanel({
    lang,
    detail,
    loading = false,
    isSubmitting,
    onSaveItem,
    onSubmitSession,
    onCloseMobile,
}: StockCountWorkPanelProps) {
    const [selectedItem, setSelectedItem] = useState<StockCountItemRow | null>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "issue" | "done">("all");
    const { t } = useTranslation();
    const text = t.stockCount.workPanel;

    const items = detail?.items ?? [];
    const progress = useMemo(() => getProgress(items), [items]);
    const visibleItems = useMemo(() => {
        if (filter === "pending") {
            return items.filter((item) => item.counted_quantity === null || item.counted_quantity === undefined);
        }
        if (filter === "issue") return items.filter((item) => item.has_discrepancy);
        if (filter === "done") {
            return items.filter((item) => item.counted_quantity !== null && item.counted_quantity !== undefined);
        }
        return items;
    }, [filter, items]);

    const submit = async () => {
        const action = onSubmitSession();
        gooeyToast.promise(action, {
            loading: text.submitting,
            success: text.submitOk,
            error: text.submitError,
            description: {
                success: text.submitOk,
                error: text.submitError,
            },
            action: { error: { label: text.retry, onClick: submit } },
        });
        await action;
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] border border-[var(--color-border-soft)]" />
                ))}
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="hidden lg:flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-center p-6 shadow-sm transition-all duration-200 hover:shadow-md">
                <ClipboardCheck className="h-9 w-9 text-[var(--color-neutral-300)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--color-text-secondary)]">{text.empty}</p>
            </div>
        );
    }

    const progressPercentage = progress.total > 0 ? Math.round((progress.counted / progress.total) * 100) : 0;

    const content = (
        <div className="flex flex-col gap-2.5 h-full min-h-0">
            {/* Session Summary Card */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-3 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)]">{text.title}</p>
                        <h2 className="truncate text-base font-bold text-[var(--color-text-primary)] mt-0.5">
                            {detail.session.session_number}
                        </h2>
                    </div>
                </div>

                {/* Linear Progress Bar */}
                <div className="mt-2.5">
                    <div className="flex justify-between text-[9px] text-[var(--color-text-muted)] font-semibold tracking-wider">
                        <span>{text.counted}</span>
                        <span>{progressPercentage}% ({progress.counted}/{progress.total})</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-neutral-100)] border border-[var(--color-border-soft)]">
                        <div
                            className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all duration-500 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-2">
                    <Metric label={text.counted} value={`${progress.counted}/${progress.total}`} tone="info" icon={ClipboardCheck} />
                    <Metric label={text.issue} value={progress.issues.toLocaleString()} tone={progress.issues > 0 ? "warning" : "success"} icon={progress.issues > 0 ? AlertTriangle : CheckCircle2} />
                </div>

                <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={isSubmitting || progress.counted < progress.total}
                    className="flex mt-2 h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-xs font-bold text-white transition-all duration-200 disabled:opacity-50 hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] cursor-pointer shadow-sm animate-in fade-in"
                >
                    <CheckCircle2 className="size-6" />
                    <span>{text.submit}</span>
                </button>
            </div>

            {/* Filter Tabs - iOS Segmented Control style */}
            <div className="bg-[var(--color-neutral-100)] p-0.5 rounded-[var(--radius-md)] flex w-full shrink-0 gap-0.5 border border-[var(--color-border-soft)]">
                {[
                    ["all", text.all],
                    ["pending", text.pending],
                    ["issue", text.issue],
                    ["done", text.done],
                ].map(([value, label]) => {
                    const isActive = filter === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setFilter(value as typeof filter)}
                            className={`flex-1 text-center py-1.5 rounded-[var(--radius-sm)] text-[10px] font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] ${isActive
                                ? "bg-white text-[var(--color-text-primary)] shadow-sm font-bold"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Item Rows Grid Container */}
            <div className="min-h-0 flex-1 overflow-y-auto lg:bg-white lg:p-3 rounded-[var(--radius-lg)]">
                {/* Desktop Header */}
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_100px] lg:gap-3 lg:px-4 lg:py-1.5 text-xs font-semibold tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border-soft)] mb-1">
                    <div>{t.stockCount.createSheet.searchProduct.split("/")[0] || "Sản phẩm"}</div>
                    <div className="text-center">{t.stockCount.metrics.system}</div>
                    <div className="text-center">{t.stockCount.metrics.counted}</div>
                    <div className="text-center">{t.stockCount.metrics.issue}</div>
                </div>

                <div className="grid gap-1">
                    {visibleItems.map((item) => {
                        let borderLeftStyle = "border-l-[3px] border-l-[var(--color-border-subtle)]";
                        let itemBg = "bg-white hover:bg-[var(--color-neutral-50)]";
                        if (item.counted_quantity !== null) {
                            if (item.has_discrepancy) {
                                borderLeftStyle = "border-l-[3px] border-l-[var(--color-warning-icon)]";
                                itemBg = "bg-[var(--color-warning-bg)]/40 hover:bg-[var(--color-warning-bg)]/60 border-[var(--color-warning-border)]/40";
                            } else {
                                borderLeftStyle = "border-l-[3px] border-l-[var(--color-success-icon)]";
                                itemBg = "bg-[var(--color-success-bg)]/40 hover:bg-[var(--color-success-bg)]/60 border-[var(--color-success-border)]/40";
                            }
                        }

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedItem(item)}
                                className={`group flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] p-3 text-left transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_100px] lg:items-center lg:gap-3 lg:px-4 lg:py-2.5 cursor-pointer ${itemBg} ${borderLeftStyle}`}
                            >
                                {/* Mobile Card Row */}
                                <div className="flex items-center justify-between w-full lg:hidden gap-3">
                                    <div className="flex min-w-0 items-start gap-2.5">
                                        <div className="relative h-12 w-12 shrink-0 overflow-visible bg-[var(--color-surface-subtle)] border border-[var(--color-border-soft)] rounded-[var(--radius-sm)] overflow-hidden flex items-center justify-center">
                                            {item.product_image_url ? (
                                                <img src={item.product_image_url} alt={item.product_name || ""} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package className="h-6 w-6 text-[var(--color-text-muted)]" />
                                            )}
                                            {item.counted_quantity !== null && (
                                                item.has_discrepancy ? (
                                                    <div className="absolute flex justify-center items-center w-4 h-4 -bottom-2 -right-2 bg-amber-500 text-white rounded-full p-[2px] border border-white">
                                                        <AlertTriangle className="size-3" />
                                                    </div>
                                                ) : (
                                                    <div className="absolute flex justify-center items-center w-4 h-4 -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-[2px] border border-white">
                                                        <Check className="size-4" />
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs text-[var(--color-text-primary)]">
                                                {item.product_code}
                                            </p>
                                            <p className="truncate text-sm font-bold text-[var(--color-text-secondary)] mt-0.5">
                                                {item.product_name}
                                            </p>
                                            <span className="inline-block rounded-[var(--radius-xs)] bg-[var(--color-neutral-50)] border border-[var(--color-border-subtle)] px-2 pt-[4px] pb-[2px] leading-none text-xxs font-semibold text-[var(--color-brand-primary)]">
                                                {item.location_code}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className=" flex flex-col items-end">
                                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatQty(item.system_quantity)}</span>
                                            <span className={`text-lg font-bold ${item.counted_quantity === null
                                                ? "text-[var(--color-text-muted)]"
                                                : item.has_discrepancy
                                                    ? "text-[var(--color-warning-text)] font-extrabold"
                                                    : "text-[var(--color-success-text)] font-extrabold"
                                                }`}>
                                                {item.counted_quantity !== null ? formatQty(item.counted_quantity) : "—"}
                                            </span>
                                        </div>
                                        <div className="shrink-0 min-w-[48px] text-right">
                                            {item.counted_quantity === null ? (
                                                <span className="text-[var(--color-text-muted)] font-bold text-xs">—</span>
                                            ) : item.has_discrepancy ? (
                                                <div className="rounded-[var(--radius-sm)] px-2 py-1 text-center text-xxs font-black bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)] shadow-sm">
                                                    {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                                                </div>
                                            ) : (
                                                <div className="rounded-[var(--radius-sm)] px-2 py-1 text-center text-xxs font-black bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] shadow-sm">
                                                    OK
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop Grid Row */}
                                <div className="hidden lg:flex min-w-0 items-center gap-2.5">
                                    <div className="relative h-10 w-10 shrink-0 bg-[var(--color-surface-subtle)] border border-[var(--color-border-soft)] rounded-[var(--radius-sm)] overflow-hidden flex items-center justify-center">
                                        {item.product_image_url ? (
                                            <img src={item.product_image_url} alt={item.product_name || ""} className="h-full w-full object-cover" />
                                        ) : (
                                            <Package className="h-5 w-5 text-[var(--color-text-muted)]" />
                                        )}
                                        {item.counted_quantity !== null && (
                                            item.has_discrepancy ? (
                                                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border border-white">
                                                    <AlertTriangle className="size-4" />
                                                </div>
                                            ) : (
                                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border border-white">
                                                    <CheckCircle2 className="size-4" />
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                                {item.product_code}
                                            </p>
                                            <span className="inline-block rounded-[var(--radius-xs)] bg-[var(--color-neutral-50)] border border-[var(--color-border-subtle)] px-2 py-0.5 text-xxs font-bold text-[var(--color-brand-primary)]">
                                                {item.location_code}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                                            {item.product_name}
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden lg:block text-center text-sm font-bold text-[var(--color-text-primary)]">
                                    {formatQty(item.system_quantity)}
                                </div>
                                <div className="hidden lg:block text-center text-sm font-black">
                                    <span className={item.counted_quantity === null
                                        ? "text-[var(--color-text-muted)] font-medium"
                                        : item.has_discrepancy
                                            ? "text-[var(--color-warning-text)] font-extrabold"
                                            : "text-[var(--color-success-text)] font-extrabold"
                                    }>
                                        {item.counted_quantity !== null ? formatQty(item.counted_quantity) : "—"}
                                    </span>
                                </div>
                                <div className="hidden lg:flex items-center justify-center">
                                    {item.counted_quantity === null ? (
                                        <span className="text-[var(--color-text-muted)] font-bold text-xs">—</span>
                                    ) : item.has_discrepancy ? (
                                        <div className="w-full rounded-[var(--radius-sm)] py-1 text-center text-xs font-black bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)] shadow-sm">
                                            {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                                        </div>
                                    ) : (
                                        <div className="w-full rounded-[var(--radius-sm)] py-1 text-center text-xs font-black bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] shadow-sm">
                                            OK
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full min-h-0 flex flex-col gap-3">
            {/* Desktop view */}
            <div className="hidden lg:flex h-full min-h-0 flex-col gap-3">
                {content}
            </div>

            {/* Mobile native BottomSheet wrapper for workspace details (zIndex: 40) */}
            {detail && (
                <BottomSheet
                    title={selectedItem ? `${selectedItem.product_code} - ${selectedItem.product_name}` : detail.session.session_number}
                    isOpen={Boolean(detail)}
                    onClose={selectedItem ? () => setSelectedItem(null) : onCloseMobile}
                    zIndex={40}
                    defaultSnap="full"
                >
                    <div className="h-full min-h-0 py-2">
                        {selectedItem ? (
                            <ItemCountSheet
                                lang={lang}
                                item={selectedItem}
                                onClose={() => setSelectedItem(null)}
                                onSave={async (item, payload) => {
                                    await onSaveItem(item.id, payload);
                                    setSelectedItem(null);
                                }}
                                isMobile={true}
                            />
                        ) : (
                            content
                        )}
                    </div>
                </BottomSheet>
            )}

            {/* Desktop-only modal container to prevent extra bottom sheet on mobile */}
            <div className="hidden lg:block">
                <ItemCountSheet
                    lang={lang}
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onSave={async (item, payload) => {
                        await onSaveItem(item.id, payload);
                        setSelectedItem(null);
                    }}
                />
            </div>
        </div>
    );
}

function Metric({
    label,
    value,
    tone = "neutral",
    icon: Icon
}: {
    label: string;
    value: string;
    tone?: "neutral" | "success" | "warning" | "info";
    icon?: React.ComponentType<any>;
}) {
    let cardStyle = "";
    if (tone === "neutral") {
        cardStyle = "bg-[var(--color-neutral-50)] border-[var(--color-border-soft)] text-[var(--color-text-primary)]";
    } else if (tone === "info") {
        cardStyle = "bg-[var(--color-brand-primary-muted)] border-[var(--color-brand-primary-border)] text-[var(--color-brand-primary)]";
    } else if (tone === "success") {
        cardStyle = "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]";
    } else if (tone === "warning") {
        cardStyle = "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)]";
    }

    return (
        <div className={`rounded-[var(--radius-md)] border px-2.5 py-2 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${cardStyle}`}>
            <div className="flex items-center justify-between gap-1.5 opacity-80">
                <span className="text-[10px] font-bold tracking-wider">{label}</span>
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            </div>
            <p className="truncate text-md font-extrabold mt-1">
                {value}
            </p>
        </div>
    );
}

function ItemCountSheet({
    lang,
    item,
    onClose,
    onSave,
    isMobile = false,
}: {
    lang: Lang;
    item: StockCountItemRow | null;
    onClose: () => void;
    onSave: (item: StockCountItemRow, payload: UpdateStockCountItemPayload) => Promise<void>;
    isMobile?: boolean;
}) {
    const { t } = useTranslation();
    const [counted, setCounted] = useState("");
    const [condition, setCondition] = useState<StockCountItemRow["condition"]>("GOOD");
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const text = t.stockCount.workPanel.detailSheet;

    useEffect(() => {
        if (!item) return;
        setCounted(item.counted_quantity === null || item.counted_quantity === undefined ? "" : String(item.counted_quantity));
        setCondition(item.condition || "GOOD");
        setReason(item.discrepancy_reason || "");
        setNote(item.discrepancy_note || item.notes || "");
        setEvidenceUrls(item.evidence_urls || []);
    }, [item]);

    if (!item) return null;

    const nextCount = counted === "" ? item.counted_quantity ?? item.system_quantity : Number(counted);
    const discrepancy = Number.isFinite(nextCount) ? nextCount - item.system_quantity : 0;
    const hasIssue = discrepancy !== 0 || condition !== "GOOD";

    const resetForRecount = () => {
        setCounted("");
        setCondition("GOOD");
        setReason("");
        setNote("");
        setEvidenceUrls([]);
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setSaving(true);
        try {
            const urls = await Promise.all(
                Array.from(files).map((file) => uploadImageAsWebp(file, "stock-count-evidence")),
            );
            setEvidenceUrls((current) => [...current, ...urls]);
        } finally {
            setSaving(false);
        }
    };

    const save = async () => {
        if (!Number.isFinite(nextCount) || nextCount < 0) return;
        if (hasIssue && (!reason || evidenceUrls.length === 0)) {
            gooeyToast.error(text.missing);
            return;
        }
        setSaving(true);
        const action = onSave(item, {
            counted_quantity: nextCount,
            condition,
            evidence_urls: evidenceUrls,
            discrepancy_reason: hasIssue ? reason : null,
            discrepancy_note: note.trim() || null,
            notes: note.trim() || null,
            action_time: new Date().toISOString(),
        });
        gooeyToast.promise(action, {
            loading: text.saving,
            success: text.saved,
            error: text.error,
            description: { success: text.saved, error: text.error },
            action: { error: { label: "Retry", onClick: save } },
        });
        try {
            await action;
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="flex h-full flex-col gap-2.5 justify-between">
            <div className="flex flex-1 flex-col gap-2.5">
                {/* Product Info Card with Image */}
                <div className="flex gap-3 items-center rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-white p-3 shadow-sm">
                    <div className="h-14 w-14 shrink-0 bg-[var(--color-neutral-50)] border border-[var(--color-border-soft)] rounded-[var(--radius-sm)] overflow-hidden flex items-center justify-center">
                        {item.product_image_url ? (
                            <img src={item.product_image_url} alt={item.product_name || ""} className="h-full w-full object-cover" />
                        ) : (
                            <Package className="h-6 w-6 text-[var(--color-text-muted)]" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="inline-block rounded-[var(--radius-xs)] bg-[var(--color-brand-primary-muted)] border border-[var(--color-brand-primary-border)] px-2 py-0.5 text-xxs font-bold text-[var(--color-brand-primary)]">
                            {item.location_code} - {item.location_name || "Mặc định"}
                        </span>
                        <p className="mt-1 text-sm font-bold text-[var(--color-text-primary)] truncate">{item.product_name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium mt-0.5">{item.product_code}</p>
                    </div>
                </div>

                {/* Metrics boxes */}
                <div className="grid grid-cols-3 gap-2">
                    <Metric label={text.system} value={formatQty(item.system_quantity)} tone="info" icon={Package} />
                    <Metric label={text.counted} value={formatQty(nextCount)} tone={nextCount === item.system_quantity ? "success" : "neutral"} icon={ClipboardCheck} />
                    <Metric label={text.issue} value={discrepancy > 0 ? `+${discrepancy}` : String(discrepancy)} tone={discrepancy === 0 ? "success" : "warning"} icon={discrepancy === 0 ? CheckCircle2 : AlertTriangle} />
                </div>

                {/* Flanking counters +/- and Input */}
                <div className="flex w-full min-w-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const val = counted === "" ? (item.counted_quantity ?? item.system_quantity) : Number(counted);
                            setCounted(String(Math.max(0, val - 1)));
                        }}
                        className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)] active:scale-[0.90] transition-all flex items-center justify-center cursor-pointer shadow-sm animate-in fade-in"
                    >
                        <Minus className="h-5 w-5" />
                    </button>
                    <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={counted}
                        onChange={(event) => setCounted(event.target.value)}
                        placeholder={formatQty(item.counted_quantity ?? item.system_quantity)}
                        className="h-12 w-full flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-center text-2xl font-bold outline-none focus:border-[var(--color-brand-primary-border)] focus:ring-1 focus:ring-[var(--color-brand-primary-border)] transition-all shadow-sm"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            const val = counted === "" ? (item.counted_quantity ?? item.system_quantity) : Number(counted);
                            setCounted(String(val + 1));
                        }}
                        className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-brand-primary-border)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)]/80 hover:text-[var(--color-brand-primary)] active:scale-[0.90] transition-all flex items-center justify-center cursor-pointer shadow-sm animate-in fade-in"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>

                {/* Condition Buttons with Icons */}
                <div className="grid grid-cols-2 gap-2">
                    {([
                        { value: "GOOD", icon: CheckCircle2, activeClass: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)] font-bold shadow-sm" },
                        { value: "DAMAGED", icon: AlertTriangle, activeClass: "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)] font-bold shadow-sm" },
                        { value: "EXPIRED", icon: AlertTriangle, activeClass: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] font-bold shadow-sm" },
                        { value: "MISSING", icon: X, activeClass: "border-[var(--color-status-draft-border)] bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] font-bold shadow-sm" }
                    ] as const).map((opt) => {
                        const active = condition === opt.value;
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setCondition(opt.value)}
                                className={`flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border text-xs font-semibold cursor-pointer transition-all ${active
                                    ? opt.activeClass
                                    : "border-[var(--color-border-soft)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text-primary)]"
                                    }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{t.stockCount.workPanel.conditions[opt.value]}</span>
                            </button>
                        );
                    })}
                </div>

                {hasIssue && (
                    <div className="grid gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]/20 p-3 shadow-inner">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-warning-text)]">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{text.reason}</span>
                        </div>
                        <select
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-white px-2.5 text-xs outline-none focus:border-[var(--color-warning-border)] focus:ring-1 focus:ring-[var(--color-warning-border)] transition-all cursor-pointer"
                        >
                            <option value="">{text.reason}</option>
                            {reasonOptions.map((option) => (
                                <option key={option} value={option}>
                                    {t.stockCount.workPanel.reasons[option] || option}
                                </option>
                            ))}
                        </select>
                        <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            rows={1.5}
                            placeholder={text.note}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-warning-border)] focus:ring-1 focus:ring-[var(--color-warning-border)] transition-all"
                        />
                        <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-warning-border)]/60 bg-white text-xs font-semibold text-[var(--color-warning-text)] hover:bg-[var(--color-warning-bg)]/40 transition-colors active:scale-[0.98] shadow-sm">
                            <Camera className="h-3.5 w-3.5" />
                            <span>{text.evidence} ({evidenceUrls.length})</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
                        </label>

                        {/* Uploaded Evidence Image Previews with Delete Button */}
                        {evidenceUrls.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mt-0.5 border border-[var(--color-border-soft)] rounded-[var(--radius-sm)] bg-white max-h-16 overflow-y-auto p-1">
                                {evidenceUrls.map((url, index) => (
                                    <div key={url} className="relative aspect-square w-full rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] overflow-hidden group">
                                        <img src={url} alt="Evidence" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setEvidenceUrls((current) => current.filter((_, i) => i !== index))}
                                            className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-red-600 transition-colors flex items-center justify-center cursor-pointer"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={resetForRecount}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-white text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text-primary)] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                    <RotateCcw className="h-4 w-4" />
                    <span>{text.recount}</span>
                </button>
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                    <Save className="h-4 w-4" />
                    <span>{text.save}</span>
                </button>
            </div>
        </div>
    );

    if (isMobile) {
        return content;
    }

    return (
        <>
            {/* Desktop Modal Dialog */}
            {item && (
                <div className="fixed inset-0 z-55 hidden items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] lg:flex">
                    <div className="flex max-h-[90vh] w-[450px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
                            <div>
                                <p className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)]">{text.title}</p>
                                <h2 className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{item.product_code} - {item.product_name}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Form Container */}
                        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-neutral-50)]">
                            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-white p-4 shadow-sm">
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Bottom Sheet (zIndex: 50) */}
            <BottomSheet title={text.title} isOpen={Boolean(item)} onClose={onClose} defaultSnap="full" zIndex={50}>
                <div className="py-2 h-full">{content}</div>
            </BottomSheet>
        </>
    );
}
