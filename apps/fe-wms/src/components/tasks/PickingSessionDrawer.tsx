"use client";

/**
 * PickingSessionDrawer — Full-screen overlay for warehouse picking (export)
 *
 * KEY FEATURES:
 * - Loads export voucher items from Firestore
 * - User enters picked_quantity for each item
 * - ATP warning: red highlight if picked_quantity > available ATP
 * - Save draft → Submit (complete picking + deduct ATP)
 *
 * LUẬT THÉP:
 * - gooeyToast.promise for submit
 * - Anti-double-click (disable button while submitting)
 * - Light Theme only
 */

import { useEffect, useState, useCallback } from "react";
import { X, Send, Package, AlertTriangle } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  savePickingActuals,
  completePicking,
} from "../../hooks/useExportVoucherApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface PickingItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  warehouse_location_id: string;
  quantity: number; // requested
  picked_quantity: number; // actual
  notes: string;
}

interface PickingSessionDrawerProps {
  voucherId: string;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function PickingSessionDrawer({
  voucherId,
  onClose,
}: PickingSessionDrawerProps) {
  const [items, setItems] = useState<PickingItem[]>([]);
  const [voucherNumber, setVoucherNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load voucher data from Firestore ──
  useEffect(() => {
    async function load() {
      try {
        // 1. Get voucher
        const voucherSnap = await getDoc(doc(db, "export_vouchers", voucherId));
        if (!voucherSnap.exists()) {
          gooeyToast.error("Phiếu không tồn tại", {
            description: "Không tìm thấy phiếu xuất kho.",
            preset: "snappy",
          });
          onClose();
          return;
        }
        const voucher = voucherSnap.data();
        setVoucherNumber(voucher.voucher_number || "");

        // 2. Get items
        const itemsRef = collection(db, "export_vouchers", voucherId, "items");
        const itemsSnap = await getDocs(
          query(itemsRef, where("is_deleted", "==", false)),
        );

        // 3. Resolve product names
        const loadedItems: PickingItem[] = [];
        for (const itemDoc of itemsSnap.docs) {
          const d = itemDoc.data();
          let productName = d.product_id;
          let productCode = "";
          try {
            const prodSnap = await getDoc(doc(db, "products", d.product_id));
            if (prodSnap.exists()) {
              const prod = prodSnap.data();
              productName = prod.name || d.product_id;
              productCode = prod.code || "";
            }
          } catch { /* fallback to ID */ }

          loadedItems.push({
            id: itemDoc.id,
            product_id: d.product_id,
            product_name: productName,
            product_code: productCode,
            warehouse_location_id: d.warehouse_location_id || "",
            quantity: d.quantity || 0,
            picked_quantity: d.picked_quantity || 0,
            notes: d.notes || "",
          });
        }

        setItems(loadedItems);
      } catch (err) {
        console.error("[PickingSessionDrawer] Load error:", err);
        gooeyToast.error("Lỗi tải dữ liệu", {
          description: "Không thể tải thông tin phiếu xuất.",
          preset: "snappy",
        });
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [voucherId, onClose]);

  // ── Update picked quantity ──
  const updatePickedQty = useCallback((itemId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, picked_quantity: qty } : item,
      ),
    );
  }, []);

  const updateItemNotes = useCallback((itemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, notes } : item,
      ),
    );
  }, []);

  // ── Save draft ──
  const handleSaveDraft = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await gooeyToast.promise(
        savePickingActuals(
          voucherId,
          items.map((i) => ({
            id: i.id,
            picked_quantity: i.picked_quantity,
            notes: i.notes || null,
          })),
        ),
        {
          loading: "Đang lưu bản nháp...",
          success: "Đã lưu bản nháp",
          error: "Lỗi khi lưu",
          description: {
            success: "Dữ liệu soạn hàng đã được cập nhật.",
            error: "Vui lòng thử lại.",
          },
          action: {
            error: { label: "Thử lại", onClick: () => handleSaveDraft() },
          },
        },
      );
    } catch { /* toast handles */ }
    finally {
      setIsSaving(false);
    }
  }, [items, voucherId, isSaving]);

  // ── Submit: save actuals then complete picking (deduct ATP) ──
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    // Validate: at least one item has picked > 0
    const hasPickedItems = items.some((i) => i.picked_quantity > 0);
    if (!hasPickedItems) {
      gooeyToast.error("Chưa soạn hàng", {
        description: "Vui lòng nhập số lượng đã soạn cho ít nhất một sản phẩm.",
        preset: "snappy",
      });
      return;
    }

    setIsSubmitting(true);
    const submitAction = async () => {
      // 1. Save actuals first
      await savePickingActuals(
        voucherId,
        items.map((i) => ({
          id: i.id,
          picked_quantity: i.picked_quantity,
          notes: i.notes || null,
        })),
      );
      // 2. Complete picking → deduct ATP
      await completePicking(voucherId);
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading: "Đang hoàn tất soạn hàng & trừ tồn kho...",
        success: "Soạn hàng hoàn tất",
        error: "Lỗi hoàn tất soạn hàng",
        description: {
          success: "Tồn kho đã được trừ. Phiếu chuyển sang trạng thái Đã bàn giao.",
          error: "Không đủ tồn kho hoặc lỗi hệ thống. Vui lòng kiểm tra lại.",
        },
        action: {
          error: { label: "Thử lại", onClick: () => handleSubmit() },
        },
      });
      onClose();
    } catch {
      // Toast handles — ATP error will show specific product info
    } finally {
      setIsSubmitting(false);
    }
  }, [items, voucherId, isSubmitting, onClose]);

  // ── Totals ──
  const totalRequested = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPicked = items.reduce((sum, i) => sum + i.picked_quantity, 0);
  const hasOverPicked = items.some((i) => i.picked_quantity > i.quantity);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Package size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Soạn hàng
            </h2>
            <p className="text-xs text-gray-500">{voucherNumber}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Package className="h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-400">Phiếu không có sản phẩm nào.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isOverPicked = item.picked_quantity > item.quantity;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isOverPicked
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.product_code && `SKU: ${item.product_code} · `}
                        Yêu cầu: <span className="font-medium text-gray-700">{item.quantity}</span>
                      </p>
                    </div>
                    {isOverPicked && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-medium">Vượt SL</span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-0.5 block text-[11px] font-medium text-gray-400">
                        SL đã soạn
                      </label>
                      <input
                        type="number"
                        value={item.picked_quantity || ""}
                        onChange={(e) =>
                          updatePickedQty(item.id, Math.max(0, Number(e.target.value)))
                        }
                        min={0}
                        disabled={isSubmitting}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition-colors focus:ring-2 ${
                          isOverPicked
                            ? "border-amber-300 text-amber-700 focus:border-amber-400 focus:ring-amber-100"
                            : "border-gray-200 text-gray-900 focus:border-orange-400 focus:ring-orange-100"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[11px] font-medium text-gray-400">
                        Ghi chú
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItemNotes(item.id, e.target.value)}
                        placeholder="Ghi chú..."
                        disabled={isSubmitting}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 shadow-inner">
        {/* Summary */}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            Đã soạn: <span className="font-semibold text-gray-900">{totalPicked}</span>
            {" / "}
            <span className="text-gray-600">{totalRequested}</span>
          </span>
          {hasOverPicked && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={12} />
              Có sản phẩm vượt số lượng yêu cầu
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving || isSubmitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isSaving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
          >
            <Send size={14} />
            {isSubmitting ? "Đang xử lý..." : "Hoàn tất soạn hàng"}
          </button>
        </div>
      </div>
    </div>
  );
}
