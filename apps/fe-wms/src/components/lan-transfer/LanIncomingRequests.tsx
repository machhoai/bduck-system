"use client";

import { useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import type { LanTransferRequest } from "@/types/lanFileTransfer";
import { formatLanFileSize } from "@/utils/lanFileTransfer";

type LanTransferApi = ReturnType<typeof useLanFileTransfer>;

function RequestCard({
  request,
  transfer,
}: {
  request: LanTransferRequest;
  transfer: LanTransferApi;
}) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalSize = request.files.reduce((sum, file) => sum + file.size, 0);

  const accept = async () => {
    const action = async () => {
      setIsSubmitting(true);
      await transfer.acceptRequest(request);
    };
    try {
      await gooeyToast.promise(action(), {
        loading: t.lanTransfer.accepting,
        success: t.lanTransfer.acceptSuccess,
        error: t.lanTransfer.acceptError,
        description: {
          success: t.lanTransfer.acceptSuccessDesc,
          error: t.lanTransfer.acceptErrorDesc,
        },
        action: {
          error: { label: t.lanTransfer.retry, onClick: () => void accept() },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reject = async () => {
    const action = async () => {
      setIsSubmitting(true);
      await transfer.rejectRequest(request);
    };
    try {
      await gooeyToast.promise(action(), {
        loading: t.lanTransfer.rejecting,
        success: t.lanTransfer.rejectSuccess,
        error: t.lanTransfer.rejectError,
        description: {
          success: t.lanTransfer.rejectSuccessDesc,
          error: t.lanTransfer.rejectErrorDesc,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
            {request.from_display_name}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {request.files.length} {t.lanTransfer.files} - {formatLanFileSize(totalSize)}
          </p>
        </div>
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-status-pending-bg)] px-2 py-0.5 text-xxs font-bold text-[var(--color-status-pending-text)]">
          60s
        </span>
      </div>

      <div className="grid gap-1">
        {request.files.slice(0, 3).map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-1 text-xs"
          >
            <span className="truncate text-[var(--color-text-secondary)]">
              {file.name}
            </span>
            <span className="shrink-0 text-[var(--color-text-muted)]">
              {formatLanFileSize(file.size)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void reject()}
          className="flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] disabled:opacity-60"
        >
          <X size={15} />
          {t.lanTransfer.reject}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void accept()}
          className="flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:opacity-60"
        >
          <Check size={15} />
          {t.lanTransfer.accept}
        </button>
      </div>
    </article>
  );
}

export default function LanIncomingRequests({
  transfer,
}: {
  transfer: LanTransferApi;
}) {
  const { t } = useTranslation();

  return (
    <aside className="grid content-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-[var(--color-brand-primary)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {t.lanTransfer.incoming}
          </h3>
        </div>
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xxs font-bold text-[var(--color-text-secondary)]">
          {transfer.pendingCount}
        </span>
      </div>

      {transfer.incomingRequests.length === 0 ? (
        <div className="grid min-h-32 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-3 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.lanTransfer.noIncoming}
          </p>
        </div>
      ) : (
        transfer.incomingRequests.map((request: LanTransferRequest) => (
          <RequestCard key={request.id} request={request} transfer={transfer} />
        ))
      )}
    </aside>
  );
}
