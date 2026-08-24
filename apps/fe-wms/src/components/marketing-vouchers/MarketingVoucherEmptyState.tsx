import { Ticket } from "lucide-react";

export function MarketingVoucherEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
        <Ticket aria-hidden="true" size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
