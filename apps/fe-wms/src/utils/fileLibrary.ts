"use client";

import type {
  ExportVoucher,
  FileTemplateCategory,
  ImportVoucher,
  TransferOrder,
  User,
} from "@bduck/shared-types";

export type FileLibrarySourceType =
  | "IMPORT_VOUCHER"
  | "EXPORT_VOUCHER"
  | "TRANSFER_ORDER";

export type FileLibraryFormat = "pdf" | "docx" | "xlsx" | "csv" | "other";

export interface FileLibraryItem {
  id: string;
  url: string;
  fileName: string;
  extension: string;
  format: FileLibraryFormat;
  sourceType: FileLibrarySourceType;
  sourceId: string;
  sourceNumber: string;
  sourceHref: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: Date | null;
  purposeKey: "importEvidence" | "exportEvidence" | "transferEvidence";
}

export interface FileLibraryFilters {
  search: string;
  sourceType: FileLibrarySourceType | "ALL";
  format: FileLibraryFormat | "ALL";
  templateCategory: FileTemplateCategory | "ALL";
}

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "heic",
  "avif",
]);

const formatByExtension: Record<string, FileLibraryFormat> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  csv: "csv",
};

function hasToDate(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
}

export function toFileLibraryDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (hasToDate(value)) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function extractStorageFileName(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const queryMatch = decoded.match(/\/([^/?]+)\?/);
    let rawName = queryMatch?.[1] ?? "";

    if (!rawName) {
      const pathParts = new URL(decoded).pathname.split("/");
      rawName = pathParts[pathParts.length - 1] || "file";
    }

    rawName = rawName.replace(/^o\//, "");
    const timestamped = rawName.match(/^\d{13,}_(.+)$/);
    if (timestamped) rawName = timestamped[1];

    return rawName.replace(/_/g, " ");
  } catch {
    return "file";
  }
}

export function getFileExtension(fileNameOrUrl: string): string {
  const cleanName = fileNameOrUrl.split("?")[0] ?? fileNameOrUrl;
  const dotIndex = cleanName.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return cleanName.slice(dotIndex + 1).toLowerCase();
}

export function getFileFormat(extension: string): FileLibraryFormat {
  return formatByExtension[extension] ?? "other";
}

export function isImageFile(extension: string): boolean {
  return IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

function getUserName(usersById: Map<string, User>, userId: string): string {
  const user = usersById.get(userId);
  return user?.full_name || user?.username || user?.email || userId || "-";
}

function buildItem(input: {
  url: string;
  index: number;
  sourceId: string;
  sourceNumber: string;
  sourceType: FileLibrarySourceType;
  sourceHref: string;
  uploaderId: string;
  uploadedAt: Date | null;
  usersById: Map<string, User>;
}): FileLibraryItem | null {
  const fileName = extractStorageFileName(input.url);
  const extension = getFileExtension(fileName || input.url);
  if (isImageFile(extension)) return null;

  return {
    id: `${input.sourceType}:${input.sourceId}:${input.index}:${input.url}`,
    url: input.url,
    fileName,
    extension,
    format: getFileFormat(extension),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceNumber: input.sourceNumber,
    sourceHref: input.sourceHref,
    uploaderId: input.uploaderId,
    uploaderName: getUserName(input.usersById, input.uploaderId),
    uploadedAt: input.uploadedAt,
    purposeKey:
      input.sourceType === "IMPORT_VOUCHER"
        ? "importEvidence"
        : input.sourceType === "EXPORT_VOUCHER"
          ? "exportEvidence"
          : "transferEvidence",
  };
}

export function buildFileLibraryItems({
  imports,
  exports,
  transfers,
  users,
}: {
  imports: ImportVoucher[];
  exports: ExportVoucher[];
  transfers: TransferOrder[];
  users: User[];
}): FileLibraryItem[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const items: FileLibraryItem[] = [];

  imports.forEach((voucher) => {
    (voucher.attachment_urls || []).forEach((url, index) => {
      const item = buildItem({
        url,
        index,
        sourceId: voucher.id,
        sourceNumber: voucher.voucher_number,
        sourceType: "IMPORT_VOUCHER",
        sourceHref: `/vouchers?type=IMPORT&voucherId=${voucher.id}`,
        uploaderId: voucher.creator_id,
        uploadedAt: toFileLibraryDate(voucher.created_at || voucher.action_time),
        usersById,
      });
      if (item) items.push(item);
    });
  });

  exports.forEach((voucher) => {
    (voucher.attachment_urls || []).forEach((url, index) => {
      const item = buildItem({
        url,
        index,
        sourceId: voucher.id,
        sourceNumber: voucher.voucher_number,
        sourceType: "EXPORT_VOUCHER",
        sourceHref: `/vouchers?type=EXPORT&voucherId=${voucher.id}`,
        uploaderId: voucher.creator_id,
        uploadedAt: toFileLibraryDate(voucher.created_at || voucher.action_time),
        usersById,
      });
      if (item) items.push(item);
    });
  });

  transfers.forEach((order) => {
    (order.attachment_urls || []).forEach((url, index) => {
      const item = buildItem({
        url,
        index,
        sourceId: order.id,
        sourceNumber: order.order_number,
        sourceType: "TRANSFER_ORDER",
        sourceHref: `/vouchers?type=TRANSFER&orderId=${order.id}`,
        uploaderId: order.creator_id,
        uploadedAt: toFileLibraryDate(order.created_at || order.action_time),
        usersById,
      });
      if (item) items.push(item);
    });
  });

  return items.sort((a, b) => {
    const aTime = a.uploadedAt?.getTime() ?? 0;
    const bTime = b.uploadedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function filterFileLibraryItems(
  items: FileLibraryItem[],
  filters: FileLibraryFilters,
  purposeResolver: (key: FileLibraryItem["purposeKey"]) => string,
) {
  const keyword = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.sourceType !== "ALL" && item.sourceType !== filters.sourceType) {
      return false;
    }
    if (filters.format !== "ALL" && item.format !== filters.format) {
      return false;
    }
    if (!keyword) return true;

    return [
      item.fileName,
      item.extension,
      item.sourceNumber,
      item.uploaderName,
      purposeResolver(item.purposeKey),
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
}
