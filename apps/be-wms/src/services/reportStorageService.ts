import { storage } from "../config/firebase.js";

const REPORT_STORAGE_ROOT = "report-templates";

function getBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  return bucketName ? storage.bucket(bucketName) : storage.bucket();
}

export async function saveReportFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await getBucket().file(path).save(buffer, {
    resumable: false,
    metadata: { contentType },
  });
}

export async function readReportFile(path: string): Promise<Buffer> {
  const [buffer] = await getBucket().file(path).download();
  return buffer;
}

export function buildTemplateStoragePath(
  templateId: string,
  versionId: string,
  fileName: string,
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${REPORT_STORAGE_ROOT}/${templateId}/${versionId}/${safeName}`;
}

export function buildExportStoragePath(exportId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `report-exports/${exportId}/${safeName}`;
}
