"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, Save, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  externalCountApi,
  type ExternalCountDetail,
  type ExternalCountItem,
} from "@/api/externalCountApi";

const conditionOptions = ["GOOD", "DAMAGED", "EXPIRED", "MISSING"];

function itemLabel(item: ExternalCountItem) {
  return item.product_barcode || item.product_code || item.product_name || item.product_id;
}

export default function ExternalCountDrawer({
  sessionId,
  onClose,
  onChanged,
}: {
  sessionId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ExternalCountDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; condition: string; notes: string }>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const response = await externalCountApi.get(sessionId);
      if (disposed) return;
      setDetail(response.data);
      setDrafts(
        Object.fromEntries(
          response.data.items.map((item) => [
            item.id,
            {
              quantity: item.counted_quantity == null ? "" : String(item.counted_quantity),
              condition: item.condition || "GOOD",
              notes: item.notes || "",
            },
          ]),
        ),
      );
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  const summary = useMemo(() => {
    const items = detail?.items ?? [];
    return {
      total: items.length,
      counted: items.filter((item) => item.counted_quantity != null).length,
      issues: items.filter((item) => item.has_discrepancy).length,
    };
  }, [detail]);

  const saveItem = async (item: ExternalCountItem) => {
    const draft = drafts[item.id];
    const quantity = Number(draft?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      gooeyToast.error("Số lượng không hợp lệ", {
        description: "Vui lòng nhập số nguyên lớn hơn hoặc bằng 0.",
      });
      return;
    }
    setBusyItemId(item.id);
    const action = externalCountApi.updateItem(sessionId, item.id, {
      counted_quantity: quantity,
      condition: draft.condition,
      notes: draft.notes || null,
    });
    gooeyToast.promise(action, {
      loading: "Đang lưu dòng kiểm đếm...",
      success: "Đã lưu dòng kiểm đếm",
      error: "Không thể lưu dòng kiểm đếm",
      description: {
        success: "Snapshot ATP tại lúc đếm đã được giữ lại.",
        error: "Vui lòng kiểm tra quyền hoặc thử lại.",
      },
      action: { error: { label: "Thử lại", onClick: () => saveItem(item) } },
    });
    try {
      const response = await action;
      setDetail(response.data);
      onChanged();
    } catch (error) {
      console.error("[ExternalCountDrawer] save item failed", error);
    } finally {
      setBusyItemId(null);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    const action = externalCountApi.submit(sessionId);
    gooeyToast.promise(action, {
      loading: "Đang nộp phiên kiểm đếm...",
      success: "Đã nộp phiên kiểm đếm",
      error: "Không thể nộp phiên",
      description: {
        success: "Chênh lệch nếu có đã được chuyển sang luồng xử lý.",
        error: "Vui lòng nhập đủ số đếm trước khi nộp.",
      },
      action: { error: { label: "Thử lại", onClick: submit } },
    });
    try {
      const response = await action;
      setDetail(response.data);
      onChanged();
    } catch (error) {
      console.error("[ExternalCountDrawer] submit failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async () => {
    if (cancelReason.trim().length < 3) {
      gooeyToast.error("Thiếu lý do hủy", {
        description: "Lý do hủy cần có ít nhất 3 ký tự.",
      });
      return;
    }
    setIsCanceling(true);
    const action = externalCountApi.cancel(sessionId, cancelReason.trim());
    gooeyToast.promise(action, {
      loading: "Đang hủy phiên kiểm đếm...",
      success: "Đã hủy phiên kiểm đếm",
      error: "Không thể hủy phiên",
      description: {
        success: "Lý do hủy đã được ghi vào audit log.",
        error: "Vui lòng kiểm tra quyền hoặc thử lại.",
      },
      action: { error: { label: "Thử lại", onClick: cancel } },
    });
    try {
      await action;
      onChanged();
      onClose();
    } catch (error) {
      console.error("[ExternalCountDrawer] cancel failed", error);
    } finally {
      setIsCanceling(false);
    }
  };

  const session = detail?.session;
  const isLocked = ["VERIFIED", "RESOLVED", "CANCELLED"].includes(session?.status || "");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full flex-col bg-white shadow-xl lg:w-[920px]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              {session?.session_number || "Phiên kiểm đếm"}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {session?.location_name || session?.location_code || "Quầy"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {session?.blind_count_enabled ? "Blind count đang bật" : "Hiển thị ATP hỗ trợ kiểm đếm"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!detail ? (
          <div className="grid gap-3 p-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-2 border-b border-[var(--color-border-subtle)] p-4 sm:grid-cols-3">
              <Metric label="Dòng hàng" value={summary.total} />
              <Metric label="Đã đếm" value={summary.counted} />
              <Metric label="Cần xử lý" value={summary.issues} />
            </div>
            <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-4">
              <div className="grid gap-3">
                {detail.items.map((item) => {
                  const draft = drafts[item.id] || { quantity: "", condition: "GOOD", notes: "" };
                  return (
                    <div key={item.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-3">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_150px_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-[var(--color-brand-primary)]" />
                            <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                              {itemLabel(item)}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                            {item.product_name || "-"} · {item.product_unit || "unit"}
                          </p>
                          {!session?.blind_count_enabled && (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                              ATP lúc tạo {item.atp_snapshot} · ATP lúc đếm {item.expected_at_count_time ?? "-"} · hiện tại {item.current_atp ?? "-"}
                            </p>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={draft.quantity}
                          disabled={isLocked}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, quantity: event.target.value },
                            }))
                          }
                          className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
                          placeholder="SL đếm"
                        />
                        <select
                          value={draft.condition}
                          disabled={isLocked}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, condition: event.target.value },
                            }))
                          }
                          className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        >
                          {conditionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => saveItem(item)}
                          disabled={isLocked || busyItemId === item.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Lưu
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 border-t border-[var(--color-border-subtle)] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                value={cancelReason}
                disabled={isLocked}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Lý do hủy phiên nếu cần"
                className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
              <button
                type="button"
                onClick={cancel}
                disabled={isLocked || isCanceling}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-error-border)] px-4 text-sm font-semibold text-[var(--color-error-text)] disabled:opacity-50"
              >
                Hủy phiên
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isLocked || isSubmitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Nộp kiểm đếm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{value.toLocaleString()}</p>
    </div>
  );
}

