import type { FileTemplate } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";

const COLLECTION = "file_templates";

function toMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime() || 0;
}

class FileTemplateRepository extends BaseRepository<FileTemplate> {
  constructor() {
    super(COLLECTION);
  }

  async findActive(): Promise<FileTemplate[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs
      .map((doc) => doc.data() as FileTemplate)
      .sort((a, b) => {
        const aTime = toMillis(a.created_at);
        const bTime = toMillis(b.created_at);
        return bTime - aTime;
      });
  }
}

export const fileTemplateRepository = new FileTemplateRepository();
