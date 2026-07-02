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
