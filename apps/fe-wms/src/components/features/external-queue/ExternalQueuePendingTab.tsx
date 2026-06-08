"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Search, Inbox } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { externalQueueApi } from "../../../api/externalQueueApi";
import BatchDetailDrawer from "./BatchDetailDrawer";

export default function ExternalQueuePendingTab() {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBatches = useCallback(async () => {
        try {
            const result = await externalQueueApi.getPendingBatches();
            if (result && result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Failed to fetch pending batches", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBatches();
        const interval = setInterval(fetchBatches, 5000);
        return () => clearInterval(interval);
    }, [fetchBatches]);

    const pendingBatches = data || [];

    const filteredBatches = pendingBatches.filter((batch: any) => 
        batch.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.operator_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && pendingBatches.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-md animate-pulse" />
                ))}
            </div>
        );
    }

    if (pendingBatches.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-[var(--color-border-subtle)]">
                <Inbox size={48} className="text-gray-300 mb-4" />
                <h3 className="text-base font-semibold text-gray-700">{t.externalQueue?.pendingTab?.emptyTitle || "Không có yêu cầu chờ duyệt"}</h3>
                <p className="text-sm text-gray-500 mt-1">{t.externalQueue?.pendingTab?.emptyHint || "Các batch quét mã từ máy POS sẽ hiện ở đây."}</p>
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
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{t.externalQueue?.pendingTab?.columns?.batchId || "Mã đợt"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{t.externalQueue?.pendingTab?.columns?.shiftDate || "Ngày ca"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{t.externalQueue?.pendingTab?.columns?.operator || "Nhân viên"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b text-right">{t.externalQueue?.pendingTab?.columns?.totalQty || "Tổng SL"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b text-right">{t.externalQueue?.pendingTab?.columns?.totalValue || "Tổng tiền"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b">{t.externalQueue?.pendingTab?.columns?.submittedAt || "TG gửi"}</th>
                            <th className="p-2 text-xxs uppercase tracking-wider font-semibold text-gray-600 border-b w-24"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBatches.map((batch: any) => (
                            <tr key={batch.batch_id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-2 text-sm font-medium text-blue-600">{batch.batch_id}</td>
                                <td className="p-2 text-sm text-gray-700">{batch.shift_date}</td>
                                <td className="p-2 text-sm text-gray-700">{batch.operator_name}</td>
                                <td className="p-2 text-sm font-semibold text-right">{batch.total_quantity}</td>
                                <td className="p-2 text-sm text-right">{batch.total_value?.toLocaleString()}</td>
                                <td className="p-2 text-sm text-gray-500">
                                    {batch.submitted_at ? format(new Date(batch.submitted_at), "HH:mm dd/MM/yyyy", { locale: vi }) : ""}
                                </td>
                                <td className="p-2">
                                    <button
                                        onClick={() => setSelectedBatchId(batch.batch_id)}
                                        className="h-6 px-3 bg-[var(--color-brand-primary)] text-white text-xs rounded-md hover:bg-[var(--color-brand-primary-hover)] transition-colors w-full"
                                    >
                                        Duyệt
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedBatchId && (
                <BatchDetailDrawer
                    batchId={selectedBatchId}
                    batchData={pendingBatches.find((b: any) => b.batch_id === selectedBatchId)}
                    onClose={() => setSelectedBatchId(null)}
                    onSuccess={() => {
                        setSelectedBatchId(null);
                        fetchBatches();
                    }}
                />
            )}
        </div>
    );
}
