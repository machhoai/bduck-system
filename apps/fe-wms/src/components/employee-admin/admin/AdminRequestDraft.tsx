"use client";

const requestTypeKeys = [
  "paidLeave",
  "unpaidLeave",
  "maternityLeave",
  "sickLeave",
];

export function AdminRequestDraft({ labels }: { labels: Record<string, string> }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {labels.requestType}
        </span>
        <select className="mt-1 h-11 w-full rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]">
          {requestTypeKeys.map((key) => (
            <option key={key}>{labels[key]}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.startDate}
          </span>
          <input
            type="date"
            className="mt-1 h-11 w-full rounded-2xl border border-[var(--color-border-soft)] px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.endDate}
          </span>
          <input
            type="date"
            className="mt-1 h-11 w-full rounded-2xl border border-[var(--color-border-soft)] px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {labels.reason}
        </span>
        <textarea
          rows={4}
          className="mt-1 w-full resize-none rounded-2xl border border-[var(--color-border-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          placeholder={labels.reasonPlaceholder}
        />
      </label>
      <div className="rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {labels.attachTemplate}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {labels.attachTemplateHint}
        </p>
      </div>
    </div>
  );
}
