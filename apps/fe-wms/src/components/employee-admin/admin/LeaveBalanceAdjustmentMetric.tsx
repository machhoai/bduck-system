export function LeaveBalanceAdjustmentMetric({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface-card)] p-3 text-center">
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--color-text-primary)]">
        {value?.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) ?? "—"}
      </p>
    </div>
  );
}
