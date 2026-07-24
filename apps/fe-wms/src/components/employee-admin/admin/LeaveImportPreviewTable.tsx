"use client";

import {
  LeaveImportBatchStatus,
  LeaveImportRecordType,
  type LeaveImportBatchView,
} from "@bduck/shared-types";
import { CheckCircle2, CircleAlert } from "lucide-react";

const typeLabel = (
  type: LeaveImportRecordType,
  labels: Record<string, string>,
) =>
  ({
    [LeaveImportRecordType.HISTORICAL_REQUEST]:
      labels.leaveImportTypeHistorical,
    [LeaveImportRecordType.ACCRUAL]: labels.leaveImportTypeAccrual,
    [LeaveImportRecordType.USED]: labels.leaveImportTypeUsed,
    [LeaveImportRecordType.ADJUSTMENT]: labels.leaveImportTypeAdjustment,
    [LeaveImportRecordType.EXPIRED]: labels.leaveImportTypeExpired,
  })[type] ?? type;

export function LeaveImportPreviewTable({
  labels,
  preview,
}: {
  labels: Record<string, string>;
  preview: LeaveImportBatchView;
}) {
  const canCommit =
    preview.batch.invalid_rows === 0 &&
    preview.batch.status !== LeaveImportBatchStatus.COMMITTED;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          [labels.leaveImportTotalRows, preview.batch.total_rows, "text-slate-700"],
          [labels.leaveImportValidRows, preview.batch.valid_rows, "text-emerald-700"],
          [labels.leaveImportInvalidRows, preview.batch.invalid_rows, "text-rose-700"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3 text-center"
          >
            <p className={`text-lg font-bold ${tone}`}>{value}</p>
            <p className="text-[10px] font-medium text-[var(--color-text-muted)]">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div
        className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-xs ${
          canCommit
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {canCommit ? (
          <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
        ) : (
          <CircleAlert className="mt-0.5 shrink-0" size={15} />
        )}
        <span>
          {canCommit
            ? labels.leaveImportReadyToCommit
            : preview.batch.status === LeaveImportBatchStatus.COMMITTED
              ? labels.leaveImportAlreadyCommitted
              : labels.leaveImportFixInvalidRows}
        </span>
      </div>
      <div className="max-h-[42vh] overflow-auto rounded-2xl border border-[var(--color-border-soft)]">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{labels.employeeCode}</th>
              <th className="px-3 py-2">{labels.leaveImportRecordType}</th>
              <th className="px-3 py-2">{labels.leaveImportPostingDate}</th>
              <th className="px-3 py-2">{labels.leaveImportUnits}</th>
              <th className="px-3 py-2">{labels.leaveImportValidation}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {preview.rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-3 py-2 font-mono text-slate-500">
                  {row.row_number}
                </td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-800">
                    {row.employee_code}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {row.employee_name || labels.notUpdated}
                  </p>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {typeLabel(row.record_type, labels)}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {row.normalized_payload.posting_date}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-700">
                  {row.normalized_payload.units ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {row.is_valid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={13} />
                      {labels.leaveImportValid}
                    </span>
                  ) : (
                    <ul className="space-y-1 text-rose-700">
                      {row.validation_messages.map((message, index) => (
                        <li key={`${row.id}-${index}`}>
                          •{" "}
                          {labels.leaveImportLocale === "zh"
                            ? message.zh
                            : message.vi}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
