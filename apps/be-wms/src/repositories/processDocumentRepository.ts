import type { ProcessDocument } from "@bduck/shared-types";
import { BaseRepository } from "./baseRepository.js";

const COLLECTION = "process_documents";

function toMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime() || 0;
}

class ProcessDocumentRepository extends BaseRepository<ProcessDocument> {
  constructor() {
    super(COLLECTION);
  }

  async findActive(): Promise<ProcessDocument[]> {
    const rows = await this.findAll();
    return rows.sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
  }
}

export const processDocumentRepository = new ProcessDocumentRepository();
