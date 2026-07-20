import type { ProcessDocumentType } from "@bduck/shared-types";
import type { Language } from "@/lib/i18n";

export const PROCESS_DOCUMENT_TYPE_OPTIONS = [
  "operations",
  "admin",
  "finance",
  "delivery",
  "general",
] satisfies ProcessDocumentType[];

const labels: Record<Language, Record<ProcessDocumentType, string>> = {
  vi: {
    operations: "Vận hành",
    admin: "Hành chính",
    finance: "Tài chính",
    delivery: "Giao nhận",
    general: "Tổng hợp",
  },
  zh: {
    operations: "运营",
    admin: "行政",
    finance: "财务",
    delivery: "交接",
    general: "综合",
  },
};

export function getProcessDocumentTypeLabel(
  type: ProcessDocumentType | undefined,
  lang: Language,
) {
  return labels[lang][type || "general"];
}
