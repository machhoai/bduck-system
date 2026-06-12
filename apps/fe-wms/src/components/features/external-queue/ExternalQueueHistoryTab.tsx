"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Search, History } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { externalQueueApi } from "../../../api/externalQueueApi";

export default function ExternalQueueHistoryTab() {
    const { t } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const [searchTerm, setSearchTerm] = useState("");
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        try {
            const result = await externalQueueApi.getHistory();
            if (result && result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Failed to fetch history batches", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const historyBatches = data || [];

    const filteredBatches = historyBatches.filter((batch: any) => 
        batch.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.operator_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && historyBatches.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-md animate-pulse" />
                ))}
            </div>
        );
    }

    if (historyBatches.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-[var(--color-border-subtle)]">
                <History size={48} className="text-gray-300 mb-4" />
                <h3 className="text-base font-semibold text-gray-700">{externalQueueText?.historyTab?.emptyTitle || "Không có lịch sử"}</h3>
                <p className="text-sm text-gray-500 mt-1">{externalQueueText?.historyTab?.emptyHint || "Chưa có batch nào được duyệt hoặc từ chối."}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
            {/* Toolbar */}
            <div className="p-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                <div className="relative w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 h-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.batchId || "Mã đợt"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.shiftDate || "Ngày ca"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.operator || "Nhân viên"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b text-right">{externalQueueText?.historyTab?.columns?.totalQty || "Tổng SL"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.status || "Trạng thái"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.processedAt || "TG xử lý"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{externalQueueText?.historyTab?.columns?.processedBy || "Người xử lý"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBatches.map((batch: any) => (
                            <tr key={batch.batch_id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-2 text-sm font-medium text-gray-700">{batch.batch_id}</td>
                                <td className="p-2 text-sm text-gray-700">{batch.shift_date}</td>
                                <td className="p-2 text-sm text-gray-700">{batch.operator_name}</td>
                                <td className="p-2 text-sm font-semibold text-right">{batch.total_quantity}</td>
                                <td className="p-2 text-sm">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        batch.status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}>
                                        {batch.status === "APPROVED" ? "Đã duyệt" : "Từ chối"}
                                    </span>
                                </td>
                                <td className="p-2 text-sm text-gray-500">
                                    {batch.processed_at ? format(new Date(batch.processed_at), "HH:mm dd/MM/yyyy", { locale: vi }) : ""}
                                </td>
                                <td className="p-2 text-sm text-gray-700">{batch.processed_by_name || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
