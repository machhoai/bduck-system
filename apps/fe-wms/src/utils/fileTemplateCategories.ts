import type { FileTemplateCategory } from "@bduck/shared-types";

export const FILE_TEMPLATE_CATEGORY_OPTIONS: FileTemplateCategory[] = [
  "finance",
  "admin",
  "delivery",
  "operations",
  "general",
];

export const FILE_TEMPLATE_CATEGORY_SET = new Set<FileTemplateCategory>(
  FILE_TEMPLATE_CATEGORY_OPTIONS,
);
