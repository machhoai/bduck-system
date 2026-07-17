import type { FileTemplateBundle } from "@bduck/shared-types";
import { BaseRepository } from "./baseRepository.js";

const COLLECTION = "file_template_bundles";

class FileTemplateBundleRepository extends BaseRepository<FileTemplateBundle> {
  constructor() {
    super(COLLECTION);
  }

  async findActive(): Promise<FileTemplateBundle[]> {
    const rows = await this.findAll();
    return rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }
}

export const fileTemplateBundleRepository = new FileTemplateBundleRepository();
