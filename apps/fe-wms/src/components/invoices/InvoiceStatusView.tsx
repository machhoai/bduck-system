// Reusable status UI for invoice lists and detail panels.
import type {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
} from "@bduck/shared-types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  ShieldAlert,
} from "lucide-react";

import {
  getInvoiceStatusPresentation,
  invoiceStatusToneClasses,
  type InvoiceStatusContext,
  type InvoiceStatusLanguage,
  type InvoiceStatusTone,
} from "./invoiceStatusPresentation";

const StatusIcon = ({ tone }: { tone: InvoiceStatusTone }) => {
  if (tone === "success") return <CheckCircle2 size={15} />;
  if (tone === "danger") return <ShieldAlert size={15} />;
  if (tone === "warning") return <AlertTriangle size={15} />;
  if (tone === "info") return <Clock3 size={15} />;
  return <Info size={15} />;
};

export function InvoiceStatusBadge({
  status,
  lang,
  context,
}: {
  status: InvoiceDocumentStatus | InvoiceIssueItemStatus;
  lang: InvoiceStatusLanguage;
  context?: InvoiceStatusContext;
}) {
  const presentation = getInvoiceStatusPresentation(status, lang, context);
  const title = [presentation.detail, presentation.action]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-left text-xs font-semibold ${invoiceStatusToneClasses[presentation.tone].badge}`}
    >
      <StatusIcon tone={presentation.tone} />
      <span className="truncate">{presentation.label}</span>
    </span>
  );
}

export function InvoiceStatusPanel({
  status,
  lang,
  context,
}: {
  status: InvoiceDocumentStatus | InvoiceIssueItemStatus;
  lang: InvoiceStatusLanguage;
  context?: InvoiceStatusContext;
}) {
  const presentation = getInvoiceStatusPresentation(status, lang, context);
  const classes = invoiceStatusToneClasses[presentation.tone];

  return (
    <div className={`mt-2 rounded-lg border p-2.5 ${classes.panel}`}>
      <div className={`flex items-start gap-2 ${classes.text}`}>
        <span className="mt-0.5 shrink-0">
          <StatusIcon tone={presentation.tone} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">{presentation.label}</p>
          <p className="mt-0.5 text-xxs leading-relaxed opacity-85">
            {presentation.detail}
          </p>
          {presentation.action && (
            <p className="mt-1 text-xxs font-semibold leading-relaxed">
              {presentation.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
