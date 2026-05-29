"use client";

/**
 * ApprovalModal — Standalone modal for quick Approve/Reject
 *
 * LUẬT THÉP:
 * - gooeyToast.promise for API calls
 * - Dual-language messages (i18n)
 * - Disable button while loading (anti-double-click)
 */

import { useState } from "react";
import { X, CheckCircle, XCircle } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ApprovalRecord } from "@bduck/shared-types";
import { approveRecord, rejectRecord } from "@/hooks/useApprovalApi";

interface ApprovalModalProps {
  approval: ApprovalRecord;
  onClose: () => void;
  /** "approve" or "reject" — determines default action */
  mode: "approve" | "reject";
}

export default function ApprovalModal({
  approval,
  onClose,
  mode,
}: ApprovalModalProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return; // Anti-double-click

    setIsSubmitting(true);

    const submitAction = async () => {
      if (mode === "approve") {
        return approveRecord(approval.id, comment || undefined);
      } else {
        return rejectRecord(approval.id, comment);
      }
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading:
          mode === "approve"
            ? "Đang phê duyệt..."
            : "Đang từ chối...",
        success:
          mode === "approve"
            ? "Đã phê duyệt thành công"
            : "Đã từ chối thành công",
        error: "Đã xảy ra lỗi",
        description: {
          success: "Quy trình đã được cập nhật.",
          error: "Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
        },
        action: {
          error: {
            label: "Thử lại",
            onClick: () => handleSubmit(),
          },
        },
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "approve" ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === "approve" ? "Phê duyệt" : "Từ chối"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entity info */}
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-800">Loại:</span>{" "}
            {approval.entity_type}
          </p>
          <p className="mt-1">
            <span className="font-medium text-gray-800">Mã phiếu:</span>{" "}
            {approval.entity_id?.slice(0, 12)}...
          </p>
        </div>

        {/* Comment */}
        <div className="mt-4">
          <label
            htmlFor="approval-comment"
            className="block text-sm font-medium text-gray-700"
          >
            Ghi chú {mode === "reject" && <span className="text-red-500">*</span>}
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={
              mode === "approve"
                ? "Nhập ghi chú (tùy chọn)..."
                : "Vui lòng nêu lý do từ chối..."
            }
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 
              text-sm text-gray-900 outline-none transition-colors 
              placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 
              text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === "reject" && !comment.trim())}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 
              text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50
              ${
                mode === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : mode === "approve" ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Xác nhận duyệt
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Xác nhận từ chối
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
