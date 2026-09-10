"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PaymentCategory = "cash" | "transfer" | "other";
type MappingRow = { id: number; channel: string; category: PaymentCategory };

type Copy = {
  title: string;
  description: string;
  channel: string;
  category: string;
  placeholder: string;
  add: string;
  remove: string;
  cash: string;
  transfer: string;
  other: string;
};

function toRecord(rows: MappingRow[]) {
  return Object.fromEntries(
    rows
      .map((row) => [row.channel.trim(), row.category] as const)
      .filter(([channel]) => channel.length > 0),
  );
}

function signature(value: Record<string, PaymentCategory>) {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export default function OpenApiPaymentMappingEditor({
  value,
  onChange,
  copy,
  disabled = false,
}: {
  value: Record<string, PaymentCategory>;
  onChange: (value: Record<string, PaymentCategory>) => void;
  copy: Copy;
  disabled?: boolean;
}) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<MappingRow[]>(() =>
    Object.entries(value).map(([channel, category]) => ({
      id: nextId.current++,
      channel,
      category,
    })),
  );

  useEffect(() => {
    if (signature(value) === signature(toRecord(rows))) return;
    setRows(
      Object.entries(value).map(([channel, category]) => ({
        id: nextId.current++,
        channel,
        category,
      })),
    );
  }, [value, rows]);

  const commit = (nextRows: MappingRow[]) => {
    setRows(nextRows);
    onChange(toRecord(nextRows));
  };

  return (
    <div className="md:col-span-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--color-text-primary)]">{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{copy.description}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            commit([...rows, { id: nextId.current++, channel: "", category: "other" }])
          }
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-xs font-bold text-[var(--color-brand-primary)] disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          {copy.add}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(140px,0.55fr)_36px] gap-2">
              <label>
                <span className="sr-only">{copy.channel}</span>
                <input
                  value={row.channel}
                  disabled={disabled}
                  placeholder={copy.placeholder}
                  onChange={(event) =>
                    commit(
                      rows.map((item) =>
                        item.id === row.id ? { ...item, channel: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                />
              </label>
              <label>
                <span className="sr-only">{copy.category}</span>
                <select
                  value={row.category}
                  disabled={disabled}
                  onChange={(event) =>
                    commit(
                      rows.map((item) =>
                        item.id === row.id
                          ? { ...item, category: event.target.value as PaymentCategory }
                          : item,
                      ),
                    )
                  }
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                >
                  <option value="cash">{copy.cash}</option>
                  <option value="transfer">{copy.transfer}</option>
                  <option value="other">{copy.other}</option>
                </select>
              </label>
              <button
                type="button"
                disabled={disabled}
                aria-label={copy.remove}
                onClick={() => commit(rows.filter((item) => item.id !== row.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
