import type { SoftDeletable } from "./utility.js";

export type ManagedFileFormat = "pdf" | "docx" | "xlsx" | "csv";

export const FILE_TEMPLATE_CATEGORIES = [
  "finance",
  "admin",
  "delivery",
  "operations",
  "general",
] as const;

export type FileTemplateCategory = (typeof FILE_TEMPLATE_CATEGORIES)[number];

export const PROCESS_DOCUMENT_TYPES = [
  "operations",
  "admin",
  "finance",
  "delivery",
  "general",
] as const;

export type ProcessDocumentType = (typeof PROCESS_DOCUMENT_TYPES)[number];

export interface FileTemplateVersionEntry {
  version: number;
  file_url: string;
  file_name: string;
  file_size: number;
  file_format: ManagedFileFormat;
  uploaded_by: string;
  uploaded_at: Date;
}

export interface FileTemplate extends SoftDeletable {
  id: string;
  title: string;
  description: string | null;
  category: FileTemplateCategory;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: ManagedFileFormat;
  uploaded_by: string;
  version: number;
  version_history: FileTemplateVersionEntry[];
}

/** A named, downloadable collection of existing file templates. */
export interface FileTemplateBundle extends SoftDeletable {
  id: string;
  name: string;
  description: string | null;
  template_ids: string[];
  process_document_ids: string[];
  created_by: string;
}

/** A PDF-only operating process document shown in the file library. */
export interface ProcessDocument extends SoftDeletable {
  id: string;
  title: string;
  description: string | null;
  process_type: ProcessDocumentType;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: "pdf";
  uploaded_by: string;
}
