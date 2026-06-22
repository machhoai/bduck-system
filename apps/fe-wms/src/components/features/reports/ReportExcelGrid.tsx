"use client";

import type { ExcelCellMapping } from "@bduck/shared-types";
import type { ExcelGridSheet } from "@/utils/reportExcelClient";

interface Props {
  sheet: ExcelGridSheet | null;
  selectedCell: string | null;
  mappings: ExcelCellMapping[];
  onSelectCell: (cell: string) => void;
}

export default function ReportExcelGrid({
  sheet,
  selectedCell,
  mappings,
  onSelectCell,
}: Props) {
  const mappedCells = new Set(mappings.map((mapping) => mapping.cell));

  if (!sheet) {
    return (
      <div className="flex h-full items-center justify-center border border-dashed border-[var(--color-border-subtle)] bg-white text-sm text-[var(--color-text-muted)]">
        Chọn hoặc upload file Excel để bắt đầu mapping.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto border border-[var(--color-border-subtle)] bg-white">
      <table className="border-collapse text-sm">
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th className="sticky left-0 z-10 border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 py-1 text-xxs font-semibold text-[var(--color-text-muted)]">
                {rowIndex + 1}
              </th>
              {row.map((cell) => {
                const isSelected = selectedCell === cell.address;
                const isMapped = mappedCells.has(cell.address);
                return (
                  <td
                    key={cell.address}
                    onClick={() => onSelectCell(cell.address)}
                    className={`min-w-28 cursor-pointer border px-2 py-1 align-top text-xs ${
                      isSelected
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                        : "border-[var(--color-border-subtle)]"
                    } ${isMapped ? "bg-[var(--color-status-export-bg)]" : ""}`}
                    title={cell.address}
                  >
                    <div className="h-8 overflow-hidden">
                      {isMapped ? (
                        <span className="rounded bg-[var(--color-status-export-icon)] px-1.5 py-0.5 text-micro font-semibold text-white">
                          FIELD
                        </span>
                      ) : (
                        cell.value
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
