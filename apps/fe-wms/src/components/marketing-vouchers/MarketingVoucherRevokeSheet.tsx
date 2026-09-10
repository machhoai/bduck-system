"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  createMarketingVoucherIdempotencyKey,
  revokeMarketingVoucherCodes,
} from "@/api/marketingVoucherApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useMarketingVoucherMutation } from "@/hooks/useMarketingVoucherMutation";
import { useTranslation } from "@/lib/i18n";

export function MarketingVoucherRevokeSheet({
  codeIds,
  onClose,
  onSuccess,
}: {
  codeIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.marketingVouchers;
  const [reason, setReason] = useState("");
  const { isPending, runMutation } = useMarketingVoucherMutation();

  useEffect(() => setReason(""), [codeIds]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason) return;
    const payload = {
      code_ids: codeIds,
      reason: normalizedReason,
      idempotency_key: createMarketingVoucherIdempotencyKey("codes-revoke"),
      action_time: new Date(),
    };
    await runMutation({
      key: `revoke:${codeIds.join(",")}`,
      task: () => revokeMarketingVoucherCodes(payload, copy.toasts.error),
      messages: { ...copy.toasts, retry: t.common.retry },
      onSuccess: () => {
        onSuccess();
        onClose();
      },
    });
  };

  return (
    <BottomSheet
      isOpen
      onClose={() => {
        if (!isPending) onClose();
      }}
      defaultSnap="half"
      title={copy.codes.revokeTitle}
      desktopClassName="md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:border-0"
      contentClassName="flex-1 overflow-y-auto px-5 pb-7 md:px-7"
    >
      <form onSubmit={submit} className="pt-4">
        <h2 className="hidden text-base font-semibold text-slate-950 md:block">
          {copy.codes.revokeTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {codeIds.length} {copy.codes.selected}
        </p>
        <label className="mt-4 block text-xs font-semibold text-slate-700">
          {copy.codes.revokeReason}
          <textarea
            autoFocus
            required
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.codes.revokeReasonPlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {copy.action.cancel}
          </button>
          <button
            type="submit"
            disabled={isPending || !reason.trim()}
            className="h-8 inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {copy.codes.revoke}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
