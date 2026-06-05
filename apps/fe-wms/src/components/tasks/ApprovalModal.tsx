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
      const promise = submitAction();
      
      gooeyToast.promise(promise, {
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

      await promise;
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
              <div className="flex h-8 w-10 items-center justify-center rounded-xl bg-[var(--color-success-bg-muted)]">
                <CheckCircle className="h-5 w-5 text-[var(--color-success-icon)]" />
              </div>
            ) : (
              <div className="flex h-8 w-10 items-center justify-center rounded-xl bg-[var(--color-error-bg-muted)]">
                <XCircle className="h-5 w-5 text-[var(--color-error-icon)]" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {isApprove ? t.tasks.approval.approve : t.tasks.approval.reject}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-[var(--color-neutral-50)] p-3 text-sm text-[var(--color-text-secondary)]">
          <p>
            <span className="font-medium text-[var(--color-text-primary)]">{t.tasks.modal.type}:</span>{" "}
            {approval.entity_type}
          </p>
          <p className="mt-1">
            <span className="font-medium text-[var(--color-text-primary)]">{t.tasks.modal.entityCode}:</span>{" "}
            {approval.entity_id?.slice(0, 12)}...
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="approval-comment"
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {t.tasks.detail.notes} {!isApprove && <span className="text-[var(--color-error-text)]">*</span>}
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
            className="mt-1.5 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-50)]"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (!isApprove && !comment.trim())}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--color-text-on-dark)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isApprove
                ? "bg-[var(--color-success-icon)] hover:opacity-90"
                : "bg-[var(--color-error-icon)] hover:opacity-90"
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
