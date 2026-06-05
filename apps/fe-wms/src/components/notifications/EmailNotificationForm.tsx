"use client";

import { Mail, Send } from "lucide-react";
import EmailRecipientInput from "./EmailRecipientInput";
import QuillEmailEditor from "./QuillEmailEditor";

interface EmailNotificationFormProps {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  htmlContent: string;
  disabled: boolean;
  isSubmitting: boolean;
  labels: {
    to: string;
    cc: string;
    bcc: string;
    addEmail: string;
    emailPlaceholder: string;
    removeEmail: string;
    subject: string;
    emailBody: string;
    editorLoading: string;
    sendEmail: string;
  };
  onToChange: (emails: string[]) => void;
  onCcChange: (emails: string[]) => void;
  onBccChange: (emails: string[]) => void;
  onSubjectChange: (value: string) => void;
  onEditorChange: (html: string, text: string) => void;
  onSubmit: () => void;
}

export default function EmailNotificationForm({
  to,
  cc,
  bcc,
  subject,
  htmlContent,
  disabled,
  isSubmitting,
  labels,
  onToChange,
  onCcChange,
  onBccChange,
  onSubjectChange,
  onEditorChange,
  onSubmit,
}: EmailNotificationFormProps) {
  return (
    <section className="rounded-radius-md border border-border-subtle bg-surface-elevated p-3">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <EmailRecipientInput
              label={labels.to}
              addLabel={labels.addEmail}
              placeholder={labels.emailPlaceholder}
              removeLabel={labels.removeEmail}
              emails={to}
              required
              disabled={disabled}
              onChange={onToChange}
            />
          </div>
          <EmailRecipientInput
            label={labels.cc}
            addLabel={labels.addEmail}
            placeholder={labels.emailPlaceholder}
            removeLabel={labels.removeEmail}
            emails={cc}
            disabled={disabled}
            onChange={onCcChange}
          />
          <div className="lg:col-span-2">
            <EmailRecipientInput
              label={labels.bcc}
              addLabel={labels.addEmail}
              placeholder={labels.emailPlaceholder}
              removeLabel={labels.removeEmail}
              emails={bcc}
              disabled={disabled}
              onChange={onBccChange}
            />
          </div>
        </div>

        <label className="space-y-1">
          <span className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
            <Mail className="h-3.5 w-3.5 text-text-muted" />
            {labels.subject}
          </span>
          <input
            className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input px-2 text-sm outline-none focus:border-border-focus"
            value={subject}
            disabled={disabled}
            onChange={(event) => onSubjectChange(event.target.value)}
          />
        </label>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-text-secondary">
            {labels.emailBody}
          </p>
          <QuillEmailEditor
            value={htmlContent}
            disabled={disabled}
            placeholder={labels.emailBody}
            loadingLabel={labels.editorLoading}
            onChange={onEditorChange}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled || isSubmitting}
            onClick={onSubmit}
            className="flex h-8 w-fit items-center gap-2 rounded-radius-sm bg-brand-primary px-3 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {labels.sendEmail}
          </button>
        </div>
      </div>
    </section>
  );
}
