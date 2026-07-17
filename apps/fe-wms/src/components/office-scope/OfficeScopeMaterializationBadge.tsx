"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { OfficeScopeMaterialization } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

export function OfficeScopeMaterializationBadge({
  materialization,
  canRetry,
  onRetry,
}: {
  materialization: OfficeScopeMaterialization | null;
  canRetry: boolean;
  onRetry: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);
  if (!materialization) {
    return (
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {t.officeScope.materializationNotRecorded}
      </p>
    );
  }
  const status = materialization.status;
  const Icon =
    status === "COMPLETED"
      ? CheckCircle2
      : status === "FAILED"
        ? AlertCircle
        : LoaderCircle;
  const tone =
    status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "FAILED"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  const retry = async () => {
    if (isRetrying || status !== "FAILED") return;
    setIsRetrying(true);
    const operation = onRetry();
    try {
      void gooeyToast.promise(operation, {
        loading: t.officeScope.retryingMaterialization,
        success: t.officeScope.retryMaterializationSuccess,
        error: t.officeScope.retryMaterializationError,
        description: {
          success: t.officeScope.retryMaterializationSuccessDesc,
          error: t.officeScope.retryMaterializationErrorDesc,
        },
        action: {
          error: { label: t.common.retry, onClick: () => void retry() },
        },
      });
      await operation;
    } catch (error) {
      console.error("[OfficeScopeMaterializationBadge] retry error:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          <Icon
            size={13}
            className={status === "PENDING" ? "animate-spin" : ""}
          />
          {t.officeScope.materializationStatuses[status]}
        </span>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {t.officeScope.materializationProgress
            .replace("{completed}", String(materialization.completed_count))
            .replace("{requested}", String(materialization.requested_count))
            .replace("{failed}", String(materialization.failed_count))}
        </p>
      </div>
      {status === "FAILED" && canRetry && (
        <button
          type="button"
          disabled={isRetrying}
          onClick={() => void retry()}
          className="flex h-9 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-700 disabled:opacity-50"
        >
          <RotateCcw size={14} />
          {t.officeScope.retryMaterialization}
        </button>
      )}
    </div>
  );
}
