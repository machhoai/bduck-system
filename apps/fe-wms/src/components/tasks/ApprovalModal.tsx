"use client";

/**
 * ApprovalModal - Standalone modal for quick Approve/Reject
 *
 * LUAT THEP:
 * - gooeyToast.promise for API calls
 * - Dual-language messages (i18n)
 * - Disable button while loading (anti-double-click)
 */

import { useState } from "react";
import { CheckCircle, X, XCircle } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ApprovalRecord } from "@bduck/shared-types";
import { approveRecord, rejectRecord } from "@/hooks/useApprovalApi";
import { useTranslation } from "@/lib/i18n";

interface ApprovalModalProps {
  approval: ApprovalRecord;
  onClose: () => void;
  mode: "approve" | "reject";
}

export default function ApprovalModal({
  approval,
  onClose,
  mode,
}: ApprovalModalProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isApprove = mode === "approve";

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    const submitAction = async () => {
      if (isApprove) {
        return approveRecord(approval.id, comment || undefined);
      }
      return rejectRecord(approval.id, comment);
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading: isApprove
          ? t.tasks.approval.approving
          : t.tasks.approval.rejecting,
        success: isApprove
          ? t.tasks.approval.approveSuccess
          : t.tasks.approval.rejectSuccess,
        error: t.tasks.approval.error,
        description: {
          success: t.tasks.approval.updated,
          error: t.tasks.approval.errorDesc,
        },
        action: {
          error: {
            label: t.tasks.approval.retry,
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
      <div className="w-[calc(100%-2rem)] rounded-2xl bg-white p-4 shadow-xl sm:w-[28rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isApprove ? (
              <div className="flex h-8 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            ) : (
              <div className="flex h-8 w-10 items-center justify-center rounded-xl bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {isApprove ? t.tasks.approval.approve : t.tasks.approval.reject}
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

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-800">{t.tasks.modal.type}:</span>{" "}
            {approval.entity_type}
          </p>
          <p className="mt-1">
            <span className="font-medium text-gray-800">{t.tasks.modal.entityCode}:</span>{" "}
            {approval.entity_id?.slice(0, 12)}...
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="approval-comment"
            className="block text-sm font-medium text-gray-700"
          >
            {t.tasks.detail.notes} {!isApprove && <span className="text-red-500">*</span>}
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder={
              isApprove
                ? t.tasks.modal.approvePlaceholder
                : t.tasks.modal.rejectPlaceholder
            }
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (!isApprove && !comment.trim())}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isApprove
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : isApprove ? (
              <>
                <CheckCircle className="h-4 w-4" />
                {t.tasks.modal.confirmApprove}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                {t.tasks.modal.confirmReject}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
