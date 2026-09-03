import type {
  MarketingVoucherCode,
  MarketingVoucherExportLocale,
  MarketingVoucherExportManifest,
} from "@bduck/shared-types";

import {
  copyMarketingVoucherExportFile,
  createMarketingVoucherZip,
  saveMarketingVoucherExportFile,
  saveMarketingVoucherManifest,
} from "./marketingVoucherExportStorageService.js";
import { createMarketingVoucherWorkbook } from "./marketingVoucherWorkbookService.js";

export interface MarketingVoucherExportWorkerDependencies {
  createWorkbook(input: {
    campaignName: string;
    codes: MarketingVoucherCode[];
    locale: MarketingVoucherExportLocale;
    qrConcurrency?: number;
  }): Promise<Buffer>;
  saveFile(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ path: string; checksum: string; size_bytes: number }>;
  saveManifest(
    path: string,
    manifest: MarketingVoucherExportManifest,
  ): Promise<{ path: string; checksum: string; size_bytes: number }>;
  createZip(input: {
    outputPath: string;
    manifest: MarketingVoucherExportManifest;
  }): Promise<{ path: string; checksum: string; size_bytes: number }>;
  copyFile(sourcePath: string, outputPath: string): Promise<void>;
}

export const defaultMarketingVoucherExportWorkerDependencies: MarketingVoucherExportWorkerDependencies =
  {
    createWorkbook: createMarketingVoucherWorkbook,
    saveFile: saveMarketingVoucherExportFile,
    saveManifest: saveMarketingVoucherManifest,
    createZip: createMarketingVoucherZip,
    copyFile: copyMarketingVoucherExportFile,
  };
