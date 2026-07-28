export function BulkIssueSummaryCard({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        strong ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xxs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold tabular-nums ${
          strong ? "text-sky-800" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
