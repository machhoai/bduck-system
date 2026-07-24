"use client";

import { type LeaveImportEmployeeOption } from "@bduck/shared-types";
import { buildLeaveImportTemplateWorkbook } from "./leaveImportTemplateWorkbook";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const validateLeaveImportFile = (
  file: File,
  labels: Record<string, string>,
): string | null => {
  if (
    !file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === "application/x-msdownload"
  ) {
    return labels.leaveImportInvalidFileType;
  }
  if (file.size > MAX_FILE_BYTES) {
    return labels.leaveImportFileTooLarge;
  }
  return null;
};

export const calculateLeaveImportChecksum = async (
  file: File,
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const downloadLeaveImportTemplate = async (
  labels: Record<string, string>,
  employees: LeaveImportEmployeeOption[],
) => {
  const workbook = buildLeaveImportTemplateWorkbook(labels, employees);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = labels.leaveImportTemplateFileName;
  link.click();
  URL.revokeObjectURL(url);
};
