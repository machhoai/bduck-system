"use client";

import { useEffect, useState } from "react";
import { X, ReceiptText, Package, Wallet, Loader2, Calendar } from "lucide-react";
import { formatCurrency, formatNumber } from "./revenueDashboardUtils";
import { useTranslation } from "@/lib/i18n";
import { gooeyToast } from "goey-toast";

interface OrderDetailModalProps {
    orderId: string;
    onClose: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        async function fetchDetail() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/revenue/order-details/${orderId}`, {
                    method: "GET",
                    credentials: "include",
                });
                const json = await res.json();
                if (json.success && json.data) {
                    setData(json.data);
                } else {
                    throw new Error(json.messages?.vi || "Không thể tải chi tiết đơn hàng");
                }
            } catch (err: any) {
                gooeyToast.error("Lỗi", { description: err.message });
            } finally {
                setLoading(false);
            }
        }
        fetchDetail();
    }, [orderId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm font-sans transition-all" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-[80vw] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-inner">
                            <ReceiptText size={20} />
                        </div>
                        <div>
                            <h2 className="text-base tracking-tight text-slate-800">Chi tiết đơn hàng</h2>
                            <p className="text-xs font-medium text-slate-500">Thông tin thanh toán & hàng hóa</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700 active:scale-95"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="text-sm font-semibold text-slate-500">Đang tải chi tiết...</span>
                        </div>
                    ) : !data ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                            <div className="rounded-full bg-slate-50 p-4 ring-1 ring-slate-100">
                                <Package className="h-10 w-10 opacity-50" />
                            </div>
                            <span className="text-sm font-medium">Không tìm thấy thông tin đơn hàng</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Basic Info Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                                    <span className="text-[10px] font-medium tracking-wider text-blue-500">Mã đơn hàng</span>
                                    <span className="text-sm font-semibold tracking-tight text-blue-900 line-clamp-1" title={data.orderNumber}>{data.orderNumber}</span>
                                </div>
                                <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                                    <span className="text-[10px] font-medium tracking-wider text-emerald-500">Trạng thái</span>
                                    <span className="text-sm font-semibold tracking-tight text-emerald-900">{data.status === 3 ? "Thành công" : `Trạng thái: ${data.status}`}</span>
                                </div>
                            </div>

                            {/* Meta Info */}
                            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                                    <span className="text-xs text-slate-500">Nhân viên tạo</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase">
                                            {data.employeeName?.[0] || "?"}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-800">{data.employeeName || "-"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs text-slate-500">Thời gian</span>
                                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/50">
                                        <Calendar size={14} className="text-slate-400" />
                                        {data.createTime}
                                    </div>
                                </div>
                            </div>

                            {/* Products */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                        <Package size={14} />
                                    </div>
                                    <h3 className="text-sm text-slate-800">Sản phẩm <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{data.goodsInfo?.length || 0}</span></h3>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {data.goodsInfo?.map((item: any, idx: number) => (
                                        <div key={idx} className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                                            <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500/10 transition-colors group-hover:bg-indigo-500/40" />

                                            <div className="flex items-start justify-between gap-3 pl-2">
                                                <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{item.goodsName}</span>
                                                <span className="shrink-0 text-sm font-black tracking-tight text-indigo-600">{formatCurrency(item.realMoney)}</span>
                                            </div>
                                            <div className="ml-2 flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200/60 shadow-sm">
                                                <span className="text-xs text-slate-500">{item.goodsCategoryName || "Hàng hóa"}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-500">SL: <strong className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">{formatNumber(item.qty)}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Summary */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                                        <Wallet size={14} />
                                    </div>
                                    <h3 className="text-sm text-slate-800">Thanh toán</h3>
                                </div>

                                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Tổng phụ</span>
                                        <span className="font-semibold text-slate-700">{formatCurrency(data.sysMoney)}</span>
                                    </div>
                                    {data.discountMoney > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className=" text-slate-500">Giảm giá</span>
                                            <span className="font-semibold text-rose-500">-{formatCurrency(data.discountMoney)}</span>
                                        </div>
                                    )}
                                    {data.taxMoney > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Thuế</span>
                                            <span className="font-semibold text-slate-700">{formatCurrency(data.taxMoney)}</span>
                                        </div>
                                    )}

                                    <div className="my-1 border-t border-dashed border-slate-200"></div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-black text-slate-800">Thực thu</span>
                                        <span className="text-xl font-black tracking-tight text-blue-600">{formatCurrency(data.realMoney)}</span>
                                    </div>

                                    {data.payModeInfo?.length > 0 && (
                                        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200 shadow-sm">
                                            {data.payModeInfo.map((pay: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between text-xs">
                                                    <span className=" text-slate-500 flex items-center gap-1.5">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                                                        {pay.payMethodName}
                                                    </span>
                                                    <span className="font-semibold text-slate-800">{formatCurrency(pay.money)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* All Other Order Details (Dynamic) */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                        <ReceiptText size={14} />
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-800">Thông tin chi tiết khác</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                                    {Object.entries(data).map(([key, value]) => {
                                        // Skip objects, arrays, and fields we already display explicitly
                                        if (
                                            value === null ||
                                            value === undefined ||
                                            typeof value === "object" ||
                                            [
                                                "orderNumber",
                                                "status",
                                                "sysMoney",
                                                "discountMoney",
                                                "taxMoney",
                                                "realMoney",
                                                "employeeName",
                                                "createTime",
                                                "goodsInfo",
                                                "payModeInfo"
                                            ].includes(key)
                                        ) {
                                            return null;
                                        }

                                        return (
                                            <div key={key} className="flex flex-col gap-1 border-b border-dashed border-slate-100 pb-2">
                                                <span className="text-xs font-semibold text-slate-500 capitalize">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-800 break-words line-clamp-2" title={String(value)}>
                                                    {String(value)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
