"use client";

/**
 * ReceivingSessionDrawer — Full-screen overlay for warehouse receiving
 *
 * KEY FEATURES:
 * - Barcode Scanner: useBarcodeScanner detects rapid keyboard input
 *   and auto-increments actual_quantity for the matching SKU
 * - Local-First: Zustand + IndexedDB auto-save (debounced 500ms)
 * - Draft Indicator: Shows "Bản nháp đã lưu lúc HH:mm"
 * - Submit: Sends actuals to backend, then completes the workflow task
 *
 * LUẬT THÉP:
 * - gooeyToast.promise for submit
 * - Anti-double-click (disable button while submitting)
 * - Skeleton loading while initializing
 * - Light Theme only
 */

import { useEffect, useState, useCallback } from "react";
import {
  X,
  ScanBarcode,
  Save,
  Send,
  Clock,
  Package,
  CheckCircle,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { WorkflowTask } from "@bduck/shared-types";
import { useReceivingStore } from "@/stores/useReceivingStore";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { emitDataMutation } from "@/lib/dataInvalidation";
import ReceivingItemRow from "./ReceivingItemRow";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ReceivingSessionDrawerProps {
  task: WorkflowTask;
  onClose: () => void;
}

export default function ReceivingSessionDrawer({
  task,
  onClose,
}: ReceivingSessionDrawerProps) {
  const {
    voucherId,
    voucherNumber,
    supplierName,
    items,
    lastSavedAt,
    isDirty,
    isSubmitting,
    initSession,
    updateItemQuantity,
    incrementByBarcode,
    updateItemNotes,
    setSubmitting,
    clearSession,
  } = useReceivingStore();

  const [isLoading, setIsLoading] = useState(true);
  const [highlightedSku, setHighlightedSku] = useState<string | null>(null);

  // ── Barcode scanner integration ──
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      const found = incrementByBarcode(barcode);
      if (found) {
        setHighlightedSku(barcode.toUpperCase());
        // Flash highlight for 1.5s
        setTimeout(() => setHighlightedSku(null), 1500);

        gooeyToast.success("Đã quét mã vạch", {
          description: `SKU: ${barcode} (+1)`,
          preset: "snappy",
          timing: { displayDuration: 2000 },
        });
      } else {
        gooeyToast.error("Không tìm thấy sản phẩm", {
          description: `Mã vạch "${barcode}" không khớp với sản phẩm nào trong phiếu.`,
          preset: "snappy",
          timing: { displayDuration: 4000 },
        });
      }
    },
    [incrementByBarcode],
  );

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: !isSubmitting,
  });

  // ── Load voucher data ──
  useEffect(() => {
    const entityId =
      (task.result as Record<string, unknown>)?.entity_id as string ||
      (task as any).entity_id;

    if (!entityId) {
      setIsLoading(false);
      return;
    }

    async function fetchVoucherData() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/import-vouchers/${entityId}`,
          { credentials: "include" },
        );

        if (!res.ok) throw new Error("Failed to load voucher");

        const { data } = await res.json();
        const mappedItems = (data.items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.product_id,
          product_sku: item.product_sku || item.product_id,
          warehouse_location_id: item.warehouse_location_id,
          location_name: item.location_name || item.warehouse_location_id,
          expected_quantity: item.expected_quantity,
          actual_quantity: item.actual_quantity || 0,
          notes: item.notes || "",
        }));

        initSession(entityId, data.voucher_number, data.supplier_name, mappedItems);
      } catch (err) {
        console.error("[ReceivingSession] Load failed:", err);
        gooeyToast.error("Không thể tải phiếu nhập", {
          description: "Vui lòng thử lại sau.",
          preset: "snappy",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchVoucherData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  // ── Submit actuals ──
  const handleSubmit = async () => {
    if (isSubmitting || !voucherId) return;
    setSubmitting(true);

    const submitAction = async () => {
      // 1. Save actuals to backend
      const actualsRes = await fetch(
        `${API_BASE_URL}/api/import-vouchers/${voucherId}/actuals`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({
              id: i.id,
              actual_quantity: i.actual_quantity,
              notes: i.notes || null,
            })),
            action_time: new Date().toISOString(),
          }),
        },
      );

      if (!actualsRes.ok) {
        const err = await actualsRes.json().catch(() => null);
        throw new Error(err?.messages?.vi || "Lỗi lưu số liệu thực nhận.");
      }

      // 2. Complete receiving session (Fixed Pipeline: APPROVED → RECEIVING → COMPLETED)
      const completeRes = await fetch(
        `${API_BASE_URL}/api/import-vouchers/${voucherId}/complete-receiving`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => null);
        throw new Error(err?.messages?.vi || "Lỗi hoàn thành phiên kiểm đếm.");
      }

      emitDataMutation([
        "import_vouchers",
        "inventory",
        "workflow_tasks",
        "audit_logs",
      ]);
      return completeRes.json();
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading: "Đang gửi kết quả kiểm đếm...",
        success: "Phiên kiểm đếm hoàn tất",
        error: "Đã xảy ra lỗi",
        description: {
          success: "Số liệu thực nhận đã được lưu và quy trình đã tiếp tục.",
          error: "Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
        },
        action: {
          error: {
            label: "Thử lại",
            onClick: () => handleSubmit(),
          },
        },
      });
      clearSession();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stats ──
  const totalExpected = items.reduce((s, i) => s + i.expected_quantity, 0);
  const totalActual = items.reduce((s, i) => s + i.actual_quantity, 0);
  const completedItems = items.filter(
    (i) => i.actual_quantity > 0,
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* ═══ Header ═══ */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                // Already auto-saved to IDB, safe to close
              }
              onClose();
            }}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Phiên kiểm đếm
            </h2>
            {voucherNumber && (
              <p className="text-xs text-gray-500">
                {voucherNumber} • {supplierName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Barcode scanner indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
            <ScanBarcode className="h-3.5 w-3.5" />
            Scanner sẵn sàng
          </div>
        </div>
      </header>

      {/* ═══ Stats bar ═══ */}
      <div className="flex items-center gap-4 border-b border-gray-100 bg-white px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Package className="h-3.5 w-3.5" />
          <span>
            <span className="font-semibold text-gray-800">
              {completedItems}
            </span>
            /{items.length} sản phẩm
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>
            <span className="font-semibold text-gray-800">
              {totalActual}
            </span>
            /{totalExpected} số lượng
          </span>
        </div>

        {lastSavedAt && (
          <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
            <Clock className="h-3 w-3" />
            Nháp lưu lúc{" "}
            {lastSavedAt.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {/* ═══ Item list ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
              >
                <div className="flex gap-3">
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded bg-gray-200" />
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="h-8 flex-1 rounded-lg bg-gray-200" />
                  <div className="h-8 flex-1 rounded-lg bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ReceivingItemRow
                key={item.id}
                item={item}
                isHighlighted={
                  highlightedSku === item.product_sku.toUpperCase()
                }
                onQuantityChange={updateItemQuantity}
                onNotesChange={updateItemNotes}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ Footer actions ═══ */}
      <footer className="border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 
              text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Save className="h-4 w-4" />
            Lưu nháp & Đóng
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || completedItems === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 
              px-4 py-2.5 text-sm font-semibold text-white transition-colors 
              hover:bg-blue-700 active:bg-blue-800 
              disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gửi kết quả ({completedItems}/{items.length})
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
