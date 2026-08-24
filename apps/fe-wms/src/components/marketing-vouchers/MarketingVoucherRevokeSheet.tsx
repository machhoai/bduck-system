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
      <form onSubmit={submit} className="pt-6">
        <h2 className="hidden text-xl font-bold text-slate-950 md:block">
          {copy.codes.revokeTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {codeIds.length} {copy.codes.selected}
        </p>
        <label className="mt-6 block text-sm font-semibold text-slate-700">
          {copy.codes.revokeReason}
          <textarea
            autoFocus
            required
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.codes.revokeReasonPlaceholder}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {copy.action.cancel}
          </button>
          <button
            type="submit"
            disabled={isPending || !reason.trim()}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {copy.codes.revoke}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
