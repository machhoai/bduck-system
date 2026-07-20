"use client";

import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    FileEdit,
    History,
    LoaderCircle,
    Plus,
    Save,
    Trash2,
    XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    InvoiceDocumentStatus,
    type InvoiceDraftBuyer,
    type InvoiceSourceOrderLine,
    type InvoiceVatRateName,
} from "@bduck/shared-types";
import {
    invoiceApi,
    type InvoiceDocumentView,
    type InvoiceSourceOrderView,
} from "@/api/invoiceApi";
import { useUserStore } from "@/stores/useUserStore";
import { showToast } from "@/utils/toast";

const copy = {
    vi: {
        title: "Quy trình bản nháp",
        noDraft: "Đơn hàng chưa có bản nháp hóa đơn.",
        prepare: "Tạo bản nháp",
        preparing: "Đang tạo bản nháp…",
        loadError: "Không thể tải bản nháp hóa đơn.",
        revision: "Revision",
        sourceStale:
            "Dữ liệu HKAPI đã thay đổi. Hãy đồng bộ lại và tạo revision mới.",
        rebase: "Cập nhật draft từ HKAPI",
        buyer: "Thông tin người mua",
        fullName: "Tên người mua",
        legalName: "Tên đơn vị",
        taxCode: "Mã số thuế",
        address: "Địa chỉ",
        phone: "Điện thoại",
        email: "Email",
        payment: "Phương thức thanh toán",
        items: "Dòng hóa đơn",
        itemCode: "Mã hàng",
        itemName: "Tên hàng",
        unit: "ĐVT",
        quantity: "SL",
        unitPrice: "Đơn giá nguồn",
        discountRate: "CK %",
        discountAmount: "Tiền CK",
        vat: "VAT",
        addLine: "Thêm dòng",
        edit: "Chỉnh sửa",
        cancel: "Hủy",
        save: "Lưu revision",
        saving: "Đang lưu…",
        saveSuccess: "Đã lưu revision mới",
        saveDescription: "Số liệu đã được tính lại ở backend.",
        approve: "Duyệt bản nháp",
        reject: "Từ chối",
        reviewing: "Đang xử lý…",
        approveSuccess: "Đã duyệt bản nháp",
        rejectSuccess: "Đã từ chối bản nháp",
        reviewNote: "Ghi chú duyệt/từ chối",
        rejectNoteRequired: "Cần nhập lý do trước khi từ chối.",
        sod: "Người vừa sửa revision này không thể tự duyệt.",
        financial:
            "Revision có thay đổi tài chính và bắt buộc người khác duyệt lần hai.",
        preview: "Xem trước trên MISA",
        previewing: "Đang tạo preview…",
        previewReady: "Đã tạo bản xem trước",
        previewFailed: "Không thể tạo bản xem trước",
        previewExpires: "Link MISA có hiệu lực 5 phút.",
        validation: "Lỗi validation",
        history: "Lịch sử revision",
        editedBy: "Người sửa",
        reviewedBy: "Người duyệt",
    },
    zh: {
        title: "草稿流程",
        noDraft: "该订单尚无发票草稿。",
        prepare: "生成草稿",
        preparing: "正在生成草稿…",
        loadError: "无法加载发票草稿。",
        revision: "修订版本",
        sourceStale: "HKAPI 数据已更改，请重新同步并生成新修订版本。",
        rebase: "从 HKAPI 更新草稿",
        buyer: "买方信息",
        fullName: "购买人姓名",
        legalName: "单位名称",
        taxCode: "税号",
        address: "地址",
        phone: "电话",
        email: "邮箱",
        payment: "付款方式",
        items: "发票明细",
        itemCode: "商品代码",
        itemName: "商品名称",
        unit: "单位",
        quantity: "数量",
        unitPrice: "来源单价",
        discountRate: "折扣 %",
        discountAmount: "折扣额",
        vat: "增值税",
        addLine: "添加明细",
        edit: "编辑",
        cancel: "取消",
        save: "保存修订",
        saving: "保存中…",
        saveSuccess: "新修订已保存",
        saveDescription: "金额已由后端重新计算。",
        approve: "批准草稿",
        reject: "拒绝",
        reviewing: "处理中…",
        approveSuccess: "草稿已批准",
        rejectSuccess: "草稿已拒绝",
        reviewNote: "审核/拒绝备注",
        rejectNoteRequired: "拒绝前必须填写原因。",
        sod: "本修订的编辑者不能自行审核。",
        financial: "该修订修改了财务数据，必须由另一人进行二次审核。",
        preview: "在 MISA 中预览",
        previewing: "正在生成预览…",
        previewReady: "预览已生成",
        previewFailed: "无法生成预览",
        previewExpires: "MISA 预览链接有效期为 5 分钟。",
        validation: "验证错误",
        history: "修订历史",
        editedBy: "编辑者",
        reviewedBy: "审核者",
    },
} as const;

const vatRates: InvoiceVatRateName[] = [
    "0%",
    "5%",
    "8%",
    "10%",
    "KCT",
    "KKKNT",
];

const statusCopy: Record<"vi" | "zh", Record<InvoiceDocumentStatus, string>> = {
    vi: {
        SOURCE_SYNCED: "Đã đồng bộ nguồn",
        NEEDS_TAX_CONFIGURATION: "Thiếu cấu hình thuế",
        NEEDS_REVIEW: "Cần duyệt",
        NEEDS_SECOND_REVIEW: "Cần duyệt lần hai",
        READY_TO_ISSUE: "Sẵn sàng phát hành",
        QUEUED: "Đang chờ",
        SUBMITTING: "Đang gửi",
        PENDING_CONFIRMATION: "Chờ xác nhận",
        ISSUED: "Đã phát hành",
        RETRYABLE_ERROR: "Có thể thử lại",
        MANUAL_RECONCILIATION: "Cần đối soát",
        POST_ISSUE_REVIEW: "Kiểm tra sau phát hành",
        REJECTED: "Đã từ chối",
        CANCELLED: "Đã hủy",
        CLOSED: "Đã đóng",
    },
    zh: {
        SOURCE_SYNCED: "来源已同步",
        NEEDS_TAX_CONFIGURATION: "缺少税务配置",
        NEEDS_REVIEW: "待审核",
        NEEDS_SECOND_REVIEW: "待二次审核",
        READY_TO_ISSUE: "可开票",
        QUEUED: "排队中",
        SUBMITTING: "提交中",
        PENDING_CONFIRMATION: "待确认",
        ISSUED: "已开具",
        RETRYABLE_ERROR: "可重试",
        MANUAL_RECONCILIATION: "需人工核对",
        POST_ISSUE_REVIEW: "开票后检查",
        REJECTED: "已拒绝",
        CANCELLED: "已取消",
        CLOSED: "已关闭",
    },
};

interface EditableDraft {
    buyer: InvoiceDraftBuyer;
    payment_method_name: string;
    items: InvoiceSourceOrderLine[];
}

const toEditable = (document: InvoiceDocumentView): EditableDraft => ({
    buyer: { ...document.buyer },
    payment_method_name: document.payment_method_name,
    items: document.items.map((item) => ({ ...item })),
});

const emptyLine = (lineNumber: number): InvoiceSourceOrderLine => ({
    line_number: lineNumber,
    source_item_id: null,
    item_code: "",
    item_name: "",
    category_code: null,
    category_name: null,
    unit_name: "",
    quantity: 1,
    unit_price: 0,
    discount_rate: null,
    discount_amount: null,
    vat_rate_name: "10%",
    vat_rate: 10,
    source_amount_without_vat: null,
    source_vat_amount: null,
    source_total_amount: null,
});

export function InvoiceDraftWorkflow({
    order,
    lang,
    canPrepare,
    canReview,
    onChanged,
}: {
    order: InvoiceSourceOrderView;
    lang: "vi" | "zh";
    canPrepare: boolean;
    canReview: boolean;
    onChanged: () => Promise<void>;
}) {
    const d = copy[lang];
    const userId = useUserStore((state) => state.user?.id ?? null);
    const [document, setDocument] = useState<InvoiceDocumentView | null>(null);
    const [draft, setDraft] = useState<EditableDraft | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(Boolean(order.invoice_document_id));
    const [working, setWorking] = useState<
        "prepare" | "save" | "review" | "preview" | null
    >(null);
    const [error, setError] = useState<string | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const generation = useRef(0);

    useEffect(() => {
        const requestGeneration = ++generation.current;
        setEditing(false);
        setError(null);
        if (!order.invoice_document_id) {
            setDocument(null);
            setDraft(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        void invoiceApi
            .getDocument(order.invoice_document_id, order.warehouse_id)
            .then((value) => {
                if (generation.current !== requestGeneration) return;
                setDocument(value);
                setDraft(toEditable(value));
            })
            .catch((loadError) => {
                if (generation.current !== requestGeneration) return;
                setError(loadError instanceof Error ? loadError.message : d.loadError);
            })
            .finally(() => {
                if (generation.current === requestGeneration) setLoading(false);
            });
        return () => {
            generation.current += 1;
        };
    }, [d.loadError, order.invoice_document_id, order.warehouse_id]);

    const setCurrentDocument = (value: InvoiceDocumentView) => {
        setDocument(value);
        setDraft(toEditable(value));
        setEditing(false);
    };

    const handlePrepare = async () => {
        setWorking("prepare");
        setError(null);
        try {
            const operation = invoiceApi.prepareDocument(
                order.id,
                order.warehouse_id,
                order.source_payload_hash,
            );
            const value = await showToast.promise(operation, {
                loading: d.preparing,
                success: d.prepare,
                error: d.loadError,
                successDescription: d.saveDescription,
                errorDescription: (toastError) =>
                    toastError instanceof Error ? toastError.message : d.loadError,
            });
            setCurrentDocument(value);
            await onChanged();
        } catch (prepareError) {
            setError(
                prepareError instanceof Error ? prepareError.message : d.loadError,
            );
        } finally {
            setWorking(null);
        }
    };

    const handleSave = async () => {
        if (!document || !draft) return;
        setWorking("save");
        setError(null);
        try {
            const operation = invoiceApi.updateDocument(document.id, {
                warehouse_id: document.warehouse_id,
                expected_revision: document.revision,
                expected_source_payload_hash: order.source_payload_hash,
                buyer: draft.buyer,
                payment_method_name: draft.payment_method_name,
                items: draft.items.map((item, index) => ({
                    ...item,
                    line_number: index + 1,
                })),
            });
            const value = await showToast.promise(operation, {
                loading: d.saving,
                success: d.saveSuccess,
                error: d.loadError,
                successDescription: d.saveDescription,
                errorDescription: (toastError) =>
                    toastError instanceof Error ? toastError.message : d.loadError,
            });
            setCurrentDocument(value);
            await onChanged();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : d.loadError);
        } finally {
            setWorking(null);
        }
    };

    const handleReview = async (action: "APPROVE" | "REJECT") => {
        if (!document) return;
        if (action === "REJECT" && !reviewNote.trim()) {
            setError(d.rejectNoteRequired);
            return;
        }
        setWorking("review");
        setError(null);
        try {
            const operation = invoiceApi.reviewDocument(
                document.id,
                document.warehouse_id,
                document.revision,
                action,
                reviewNote.trim() || null,
            );
            const value = await showToast.promise(operation, {
                loading: d.reviewing,
                success: action === "APPROVE" ? d.approveSuccess : d.rejectSuccess,
                error: d.loadError,
                successDescription:
                    action === "APPROVE" ? d.approveSuccess : d.rejectSuccess,
                errorDescription: (toastError) =>
                    toastError instanceof Error ? toastError.message : d.loadError,
            });
            setReviewNote("");
            setCurrentDocument(value);
            await onChanged();
        } catch (reviewError) {
            setError(
                reviewError instanceof Error ? reviewError.message : d.loadError,
            );
        } finally {
            setWorking(null);
        }
    };

    const handlePreview = async () => {
        if (!document) return;
        const previewWindow = window.open("about:blank", "_blank");
        if (previewWindow) previewWindow.opener = null;
        setWorking("preview");
        setError(null);
        try {
            const operation = invoiceApi.previewDocument(
                document.id,
                document.warehouse_id,
                document.revision,
                order.source_payload_hash,
            );
            const result = await showToast.promise(operation, {
                loading: d.previewing,
                success: d.previewReady,
                error: d.previewFailed,
                successDescription: d.previewExpires,
                errorDescription: (toastError) =>
                    toastError instanceof Error ? toastError.message : d.previewFailed,
            });
            const url = new URL(result.url);
            if (
                url.protocol !== "https:" ||
                (url.hostname !== "meinvoice.vn" &&
                    !url.hostname.endsWith(".meinvoice.vn"))
            ) {
                throw new Error(d.previewFailed);
            }
            if (previewWindow) previewWindow.location.replace(url.toString());
            else window.open(url.toString(), "_blank", "noopener,noreferrer");
        } catch (previewError) {
            previewWindow?.close();
            setError(
                previewError instanceof Error ? previewError.message : d.previewFailed,
            );
        } finally {
            setWorking(null);
        }
    };

    const editable = Boolean(
        document &&
        [
            InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
            InvoiceDocumentStatus.NEEDS_REVIEW,
            InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
            InvoiceDocumentStatus.READY_TO_ISSUE,
            InvoiceDocumentStatus.REJECTED,
        ].includes(document.status),
    );
    const reviewable =
        document &&
        [
            InvoiceDocumentStatus.NEEDS_REVIEW,
            InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
        ].includes(document.status);
    const selfReview = Boolean(
        document?.edited_by && document.edited_by === userId,
    );
    const sourceStale =
        document?.source_payload_hash !== order.source_payload_hash;

    if (loading) {
        return (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                <LoaderCircle className="animate-spin" size={17} /> {d.preparing}
            </div>
        );
    }

    if (!document) {
        return (
            <section className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <FileEdit className="mx-auto text-slate-400" size={28} />
                <p className="mt-2 text-sm font-semibold text-slate-700">{d.noDraft}</p>
                {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
                <button
                    type="button"
                    onClick={() => void handlePrepare()}
                    disabled={!canPrepare || working !== null}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-45"
                >
                    {working === "prepare" ? (
                        <LoaderCircle className="animate-spin" size={15} />
                    ) : (
                        <Plus size={15} />
                    )}
                    {working === "prepare" ? d.preparing : d.prepare}
                </button>
            </section>
        );
    }

    return (
        <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">{d.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {d.revision} {document.revision}
                    </p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                    {statusCopy[lang][document.status]}
                </span>
            </div>

            {sourceStale && (
                <>
                    <Notice tone="danger" icon={<AlertTriangle size={15} />}>
                        {d.sourceStale}
                    </Notice>
                    <button
                        type="button"
                        onClick={() => void handlePrepare()}
                        disabled={!canPrepare || working !== null}
                        className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white disabled:opacity-45"
                    >
                        {working === "prepare" ? (
                            <LoaderCircle className="animate-spin" size={15} />
                        ) : (
                            <FileEdit size={15} />
                        )}
                        {d.rebase}
                    </button>
                </>
            )}
            {document.financially_edited && (
                <Notice tone="warning" icon={<AlertTriangle size={15} />}>
                    {d.financial}
                </Notice>
            )}
            {selfReview && (
                <Notice tone="warning" icon={<AlertTriangle size={15} />}>
                    {d.sod}
                </Notice>
            )}
            {error && (
                <Notice tone="danger" icon={<XCircle size={15} />}>
                    {error}
                </Notice>
            )}

            {editing && draft ? (
                <div className="mt-4 grid gap-4">
                    <fieldset className="grid gap-2 sm:grid-cols-2">
                        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            {d.buyer}
                        </legend>
                        {(
                            [
                                ["full_name", d.fullName],
                                ["legal_name", d.legalName],
                                ["tax_code", d.taxCode],
                                ["address", d.address],
                                ["phone_number", d.phone],
                                ["email", d.email],
                            ] as const
                        ).map(([key, label]) => (
                            <DraftField
                                key={key}
                                label={label}
                                value={draft.buyer[key]}
                                onChange={(value) =>
                                    setDraft((current) =>
                                        current
                                            ? {
                                                ...current,
                                                buyer: { ...current.buyer, [key]: value },
                                            }
                                            : current,
                                    )
                                }
                            />
                        ))}
                    </fieldset>
                    <DraftField
                        label={d.payment}
                        value={draft.payment_method_name}
                        onChange={(value) =>
                            setDraft((current) =>
                                current ? { ...current, payment_method_name: value } : current,
                            )
                        }
                    />

                    <div>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {d.items}
                            </p>
                            <button
                                type="button"
                                onClick={() =>
                                    setDraft((current) =>
                                        current
                                            ? {
                                                ...current,
                                                items: [
                                                    ...current.items,
                                                    emptyLine(
                                                        Math.max(
                                                            0,
                                                            ...current.items.map(
                                                                (item) => item.line_number,
                                                            ),
                                                        ) + 1,
                                                    ),
                                                ],
                                            }
                                            : current,
                                    )
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700"
                            >
                                <Plus size={14} /> {d.addLine}
                            </button>
                        </div>
                        <div className="mt-2 grid gap-3">
                            {draft.items.map((item, index) => (
                                <div
                                    key={`draft-line-${item.line_number}`}
                                    className="rounded-lg border border-slate-200 bg-white p-3"
                                >
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <DraftField
                                            label={d.itemCode}
                                            value={item.item_code ?? ""}
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "item_code", value)
                                            }
                                        />
                                        <DraftField
                                            label={d.itemName}
                                            value={item.item_name ?? ""}
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "item_name", value)
                                            }
                                        />
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                                        <DraftField
                                            label={d.unit}
                                            value={item.unit_name ?? ""}
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "unit_name", value)
                                            }
                                        />
                                        <NumberField
                                            label={d.quantity}
                                            value={item.quantity}
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "quantity", value)
                                            }
                                        />
                                        <NumberField
                                            label={d.unitPrice}
                                            value={item.unit_price}
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "unit_price", value)
                                            }
                                        />
                                        <NumberField
                                            label={d.discountRate}
                                            value={item.discount_rate}
                                            nullable
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "discount_rate", value)
                                            }
                                        />
                                        <NumberField
                                            label={d.discountAmount}
                                            value={item.discount_amount}
                                            nullable
                                            onChange={(value) =>
                                                updateItem(setDraft, index, "discount_amount", value)
                                            }
                                        />
                                        <label className="grid gap-1 text-[11px] font-semibold text-slate-500">
                                            {d.vat}
                                            <select
                                                value={item.vat_rate_name ?? "10%"}
                                                onChange={(event) =>
                                                    updateItem(
                                                        setDraft,
                                                        index,
                                                        "vat_rate_name",
                                                        event.target.value as InvoiceVatRateName,
                                                    )
                                                }
                                                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                                            >
                                                {vatRates.map((vat) => (
                                                    <option key={vat}>{vat}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    {draft.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setDraft((current) =>
                                                    current
                                                        ? {
                                                            ...current,
                                                            items: current.items.filter(
                                                                (_, itemIndex) => itemIndex !== index,
                                                            ),
                                                        }
                                                        : current,
                                                )
                                            }
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600"
                                        >
                                            <Trash2 size={13} /> {d.cancel}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={working !== null}
                            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white disabled:opacity-45"
                        >
                            {working === "save" ? (
                                <LoaderCircle className="animate-spin" size={16} />
                            ) : (
                                <Save size={16} />
                            )}
                            {working === "save" ? d.saving : d.save}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraft(toEditable(document));
                                setEditing(false);
                            }}
                            disabled={working !== null}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
                        >
                            {d.cancel}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <Metric label={d.fullName} value={document.buyer.full_name} />
                        <Metric label={d.payment} value={document.payment_method_name} />
                        <Metric label={d.items} value={String(document.items.length)} />
                    </div>
                    {document.calculation && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            <Metric
                                label="Trước thuế"
                                value={formatMoney(
                                    document.calculation.total_amount_without_vat,
                                )}
                            />
                            <Metric
                                label="VAT"
                                value={formatMoney(document.calculation.total_vat_amount)}
                            />
                            <Metric
                                label="Tổng"
                                value={formatMoney(document.calculation.total_amount)}
                                strong
                            />
                        </div>
                    )}
                    {document.validation_issues.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-bold text-rose-700">
                                {d.validation} ({document.validation_issues.length})
                            </p>
                            <div className="mt-1 grid gap-1">
                                {document.validation_issues.map((issue, index) => (
                                    <p
                                        key={`${issue.code}-${index}`}
                                        className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700"
                                    >
                                        <strong>{issue.code}</strong> · {issue.message}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            disabled={
                                !canPrepare || !editable || sourceStale || working !== null
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-45"
                        >
                            <FileEdit size={15} /> {d.edit}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handlePreview()}
                            disabled={
                                !canReview ||
                                !document.issue_eligible ||
                                sourceStale ||
                                working !== null
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white disabled:opacity-45"
                        >
                            {working === "preview" ? (
                                <LoaderCircle className="animate-spin" size={15} />
                            ) : (
                                <Eye size={15} />
                            )}
                            {d.preview}
                        </button>
                    </div>
                </>
            )}

            {reviewable && !editing && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                    <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder={d.reviewNote}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-sky-500"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => void handleReview("APPROVE")}
                            disabled={
                                !canReview ||
                                selfReview ||
                                !document.issue_eligible ||
                                sourceStale ||
                                working !== null
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-45"
                        >
                            {working === "review" ? (
                                <LoaderCircle className="animate-spin" size={16} />
                            ) : (
                                <CheckCircle2 size={16} />
                            )}
                            {d.approve}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleReview("REJECT")}
                            disabled={!canReview || sourceStale || working !== null}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white text-sm font-bold text-rose-700 disabled:opacity-45"
                        >
                            <XCircle size={16} /> {d.reject}
                        </button>
                    </div>
                </div>
            )}

            {document.revisions.length > 0 && (
                <details className="mt-4 border-t border-slate-200 pt-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
                        <History size={14} /> {d.history}
                    </summary>
                    <div className="mt-2 grid gap-1">
                        {document.revisions.map((revision) => (
                            <div
                                key={revision.revision}
                                className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-xs text-slate-600"
                            >
                                <span>
                                    #{revision.revision} · {statusCopy[lang][revision.status]}
                                </span>
                                <span>
                                    {revision.reviewed_by
                                        ? `${d.reviewedBy}: ${revision.reviewed_by}`
                                        : revision.edited_by
                                            ? `${d.editedBy}: ${revision.edited_by}`
                                            : "—"}
                                </span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

function updateItem(
    setDraft: React.Dispatch<React.SetStateAction<EditableDraft | null>>,
    index: number,
    key: keyof InvoiceSourceOrderLine,
    value: InvoiceSourceOrderLine[keyof InvoiceSourceOrderLine],
) {
    setDraft((current) =>
        current
            ? {
                ...current,
                items: current.items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, [key]: value } : item,
                ),
            }
            : current,
    );
}

function DraftField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="grid gap-1 text-[11px] font-semibold text-slate-500">
            {label}
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-sky-500"
            />
        </label>
    );
}

function NumberField({
    label,
    value,
    nullable = false,
    onChange,
}: {
    label: string;
    value: number | null;
    nullable?: boolean;
    onChange: (value: number | null) => void;
}) {
    return (
        <label className="grid gap-1 text-[11px] font-semibold text-slate-500">
            {label}
            <input
                type="number"
                min="0"
                step="any"
                value={value ?? ""}
                onChange={(event) =>
                    onChange(
                        event.target.value === "" && nullable
                            ? null
                            : Number(event.target.value),
                    )
                }
                className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-sky-500"
            />
        </label>
    );
}

function Notice({
    children,
    icon,
    tone,
}: {
    children: React.ReactNode;
    icon: React.ReactNode;
    tone: "warning" | "danger";
}) {
    const style =
        tone === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-amber-200 bg-amber-50 text-amber-800";
    return (
        <div
            className={`mt-3 flex items-start gap-2 rounded-lg border p-2 text-xs ${style}`}
        >
            {icon}
            <span>{children}</span>
        </div>
    );
}

function Metric({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`min-w-0 rounded-lg p-2 ${strong ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
        >
            <p
                className={`truncate text-[10px] ${strong ? "text-slate-300" : "text-slate-400"}`}
            >
                {label}
            </p>
            <p className="mt-0.5 truncate text-xs font-bold">{value || "—"}</p>
        </div>
    );
}

const formatMoney = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(value);
