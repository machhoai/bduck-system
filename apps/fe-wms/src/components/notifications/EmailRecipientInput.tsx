"use client";

import { AtSign, Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

interface EmailRecipientInputProps {
  label: string;
  addLabel: string;
  placeholder: string;
  removeLabel: string;
  emails: string[];
  disabled?: boolean;
  required?: boolean;
  onChange: (emails: string[]) => void;
}

function parseEmails(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function EmailRecipientInput({
  label,
  addLabel,
  placeholder,
  removeLabel,
  emails,
  disabled = false,
  required = false,
  onChange,
}: EmailRecipientInputProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addEmails = (rawValue: string) => {
    const nextEmails = parseEmails(rawValue);
    if (nextEmails.length === 0) return;

    const invalid = nextEmails.find((email) => !isEmail(email));
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    onChange(Array.from(new Set([...emails, ...nextEmails])));
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addEmails(draft);
    }
    if (event.key === "Backspace" && !draft && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
        <AtSign className="h-3.5 w-3.5 text-text-muted" />
        {label}
        {required && <span className="text-accent-error">*</span>}
      </label>
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-radius-sm border border-border-subtle bg-surface-input px-2 py-1 focus-within:border-border-focus">
        {emails.map((email) => (
          <span
            key={email}
            className="flex h-6 items-center gap-1 rounded-radius-pill bg-surface-subtle px-2 text-xs text-text-secondary"
          >
            {email}
            <button
              type="button"
              className="rounded-full text-text-muted hover:text-accent-error"
              disabled={disabled}
              onClick={() => onChange(emails.filter((item) => item !== email))}
              aria-label={removeLabel}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="h-6 min-w-36 flex-1 bg-transparent text-sm outline-none"
          value={draft}
          disabled={disabled}
          placeholder={emails.length === 0 ? placeholder : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addEmails(draft)}
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={() => addEmails(draft)}
          className="flex h-6 items-center gap-1 rounded-radius-sm px-2 text-xs text-brand-primary hover:bg-brand-primary-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
      </div>
      {error && (
        <p className="text-xs text-accent-error">{error}</p>
      )}
    </div>
  );
}
