import type { SoftDeletable } from "./utility.js";

export type ManagedFileFormat = "pdf" | "docx" | "xlsx" | "csv";

export interface FileTemplate extends SoftDeletable {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: ManagedFileFormat;
  uploaded_by: string;
}
