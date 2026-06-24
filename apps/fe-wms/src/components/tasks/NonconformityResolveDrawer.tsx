"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Hash,
  Package,
  Scale,
  ShieldAlert,
  Warehouse,
  X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  IssueType,
  ResolutionType,
  type NonconformityReport,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { resolveNonconformityReport } from "@/hooks/useNonconformities";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";

interface NonconformityResolveDrawerProps {
  report: NonconformityReport;
  productName: string;
  warehouseName: string;
  locationName?: string;
  reporterName: string;
  onClose: () => void;
}

function formatDate(value: unknown) {
  if (!value) return "";
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if ((value as { seconds?: number }).seconds !== undefined) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else if ((value as { _seconds?: number })._seconds !== undefined) {
    date = new Date((value as { _seconds: number })._seconds * 1000);
  } else {
    date = new Date(value as string);
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAllowedResolutions(issueType: IssueType | string) {
  if (issueType === IssueType.MISSING) return [ResolutionType.ADJUST];
  if (issueType === IssueType.DISCREPANCY) {
    return [ResolutionType.REUSE, ResolutionType.ADJUST];
  }
  return [ResolutionType.REUSE, ResolutionType.RETURN, ResolutionType.DESTROY];
}

function formatQuantity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("vi-VN")
    : null;
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-[var(--color-text-primary)]">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function NonconformityResolveDrawer({
  report,
  productName,
  warehouseName,
  locationName,
  reporterName,
  onClose,
}: NonconformityResolveDrawerProps) {
  const { t } = useTranslation();
  const currentUser = useUserStore((state) => state.user);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [resolutionType, setResolutionType] = useState<ResolutionType | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const copy = t.tasks.nonconformity;
  const issueLabel =
    copy.issueType[report.issue_type as keyof typeof copy.issueType] ||
    report.issue_type;
  const statusLabel =
    copy.status[report.status as keyof typeof copy.status] || report.status;
  const allowedResolutions = useMemo(
    () => getAllowedResolutions(report.issue_type),
    [report.issue_type],
  );
  const isReporter = currentUser?.id === report.reporter_id;
  const canResolve = hasPermission("inventory.write") && !isReporter;
  const isDiscrepancy = report.issue_type === IssueType.DISCREPANCY;
  const expectedQuantityLabel = formatQuantity(report.expected_quantity);
  const actualQuantityLabel = formatQuantity(report.actual_quantity);

  const getResolutionLabel = (option: ResolutionType) => {
    if (isDiscrepancy && option === ResolutionType.REUSE) {
      return actualQuantityLabel
        ? `Nhập kho theo số kiểm đếm (${actualQuantityLabel})`
        : "Nhập kho theo số kiểm đếm";
    }
    if (isDiscrepancy && option === ResolutionType.ADJUST) {
      return expectedQuantityLabel
        ? `Nhập kho theo số phiếu (${expectedQuantityLabel})`
        : "Nhập kho theo số phiếu";
    }
    return copy.resolutionType[option];
  };

  const getResolutionHint = (option: ResolutionType) => {
    if (isDiscrepancy && option === ResolutionType.REUSE) {
      return "Chấp nhận toàn bộ số kiểm đếm thực tế; phần chênh lệch đang tạm giữ sẽ được đưa vào ATP.";
    }
    if (isDiscrepancy && option === ResolutionType.ADJUST) {
      return "Không nhập phần chênh lệch vào ATP; tồn kho giữ theo số lượng trên phiếu.";
    }
    return copy.resolutionHint[option];
  };

  const handleResolve = async (otp: string) => {
    if (isSubmitting || !resolutionType) return;
    setIsSubmitting(true);

    const submitAction = async () => {
      await resolveNonconformityReport(report.id, {
        resolution_type: resolutionType,
        resolution_notes: notes.trim() || null,
        otp,
        action_time: new Date().toISOString(),
      });
    };

    try {
      const promise = submitAction();
      gooeyToast.promise(promise, {
        loading: copy.toast.resolving,
        success: copy.toast.resolveSuccess,
        error: copy.toast.resolveError,
        description: {
          success: copy.toast.resolveSuccessDesc,
          error: copy.toast.resolveErrorDesc,
        },
        action: {
          error: {
            label: t.common.retry,
            onClick: () => undefined,
          },
        },
      });
      await promise;
      setShowOtpModal(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-[90%] flex-col bg-white shadow-2xl lg:w-2/3">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error-text)]">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {copy.detailTitle}
              </h2>
              <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
                {report.report_number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-error-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-error-text)]">
              {issueLabel}
            </span>
            <span className="rounded-full bg-[var(--color-status-pending-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-status-pending-text)]">
              {statusLabel}
            </span>
          </div>

          <div className="mt-3">
            <Field icon={Package} label={copy.fields.product} value={productName} />
            <Field icon={Warehouse} label={copy.fields.warehouse} value={warehouseName} />
            <Field icon={Hash} label={copy.fields.location} value={locationName || report.warehouse_location_id} />
            <Field icon={Scale} label={copy.fields.quantity} value={report.quantity_affected.toLocaleString()} />
            <Field icon={ShieldAlert} label={copy.fields.reporter} value={reporterName} />
            <Field icon={FileText} label={copy.fields.createdAt} value={formatDate(report.created_at)} />
          </div>

          {!canResolve && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] p-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--color-status-pending-icon)]" />
              <p className="text-xs leading-relaxed text-[var(--color-status-pending-text)]">
                {isReporter ? copy.selfBlocked : copy.noResolvePermission}
              </p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {copy.resolutionTitle}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {allowedResolutions.map((option) => {
                const active = resolutionType === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setResolutionType(option)}
                    disabled={!canResolve || isSubmitting}
                    className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-neutral-50)]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {getResolutionLabel(option)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                      {getResolutionHint(option)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {copy.notesLabel}
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              disabled={!canResolve || isSubmitting}
              placeholder={copy.notesPlaceholder}
              className="mt-2 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface-input)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4">
          <button
            type="button"
            onClick={() => setShowOtpModal(true)}
            disabled={!canResolve || !resolutionType || isSubmitting}
            className="flex h-10 w-fit items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-[var(--color-text-on-dark)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {copy.resolveButton}
          </button>
        </div>
      </div>
      {showOtpModal && (
        <ActionOtpModal
          title="Xác thực OTP"
          description="Chức năng xử lý hàng hỏng/chênh lệch bắt buộc xác thực OTP."
          isSubmitting={isSubmitting}
          onCancel={() => setShowOtpModal(false)}
          onConfirm={(otp) => void handleResolve(otp)}
        />
      )}
    </>
  );
}
