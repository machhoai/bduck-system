import { Ticket } from "lucide-react";

export function MarketingVoucherEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center py-8">
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-700">
        <Ticket aria-hidden="true" size={20} />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
