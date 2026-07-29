"use client";

import {
  EmployeeContractImportBatchStatus,
  formatContractDisplayDate,
  type EmployeeContractImportBatchView,
} from "@bduck/shared-types";
import { CheckCircle2, CircleAlert } from "lucide-react";

import type { EmployeeContractImportLabels } from "@/lib/i18n/employeeContractImportTranslations";

export function EmployeeContractImportPreview({
  preview,
  labels,
  locale,
}: {
  preview: EmployeeContractImportBatchView;
  labels: EmployeeContractImportLabels;
  locale: "vi" | "zh";
}) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          [labels.total, preview.batch.total_rows, "text-slate-700"],
          [labels.valid, preview.batch.valid_rows, "text-emerald-700"],
          [labels.invalid, preview.batch.invalid_rows, "text-rose-700"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center"
          >
            <p className={`text-lg font-bold ${tone}`}>{value}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[42vh] overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{labels.employee}</th>
              <th className="px-3 py-2">{labels.contract}</th>
              <th className="px-3 py-2">{labels.period}</th>
              <th className="px-3 py-2">{labels.document}</th>
              <th className="px-3 py-2">{labels.validation}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-3 py-2 font-mono text-slate-500">{row.row_number}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-800">{row.employee_code}</p>
                  <p className="text-[10px] text-slate-500">{row.employee_name ?? "—"}</p>
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">
                  {row.normalized_payload.contract_number || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-slate-600">
                  {formatContractDisplayDate(row.normalized_payload.start_date)}
                  {" → "}
                  {formatContractDisplayDate(row.normalized_payload.end_date) || "∞"}
                </td>
                <td className="max-w-40 truncate px-3 py-2 text-slate-600">
                  {row.normalized_payload.pdf_file_name ?? labels.noPdf}
                </td>
                <td className="px-3 py-2">
                  {row.is_valid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={13} /> {labels.rowValid}
                    </span>
                  ) : (
                    <ul className="space-y-1 text-rose-700">
                      {row.validation_messages.map((item, index) => (
                        <li key={`${row.id}-${index}`} className="flex gap-1">
                          <CircleAlert className="mt-0.5 shrink-0" size={12} />
                          <span>{item[locale]}</span>
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
      {preview.batch.status === EmployeeContractImportBatchStatus.COMPLETED ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
          {labels.committed}
        </p>
      ) : null}
    </section>
  );
}
