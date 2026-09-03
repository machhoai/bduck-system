import { createHash } from "node:crypto";
import { PassThrough, Transform } from "node:stream";

import type { MarketingVoucherExportManifest } from "@bduck/shared-types";
import { ZipArchive } from "archiver";

import { storage } from "../config/firebase.js";

const ROOT = "marketing-voucher-exports";
const safe = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "voucher";

const bucket = () => {
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  return name ? storage.bucket(name) : storage.bucket();
};

export const marketingVoucherExportPartPath = (
  jobId: string,
  index: number,
  attemptToken: string,
) =>
  `${ROOT}/${jobId}/parts/vouchers-${String(index).padStart(5, "0")}-${safe(attemptToken)}.xlsx`;

export const marketingVoucherExportOutputPath = (
  jobId: string,
  attemptToken: string,
  fileName: string,
) => `${ROOT}/${jobId}/results/${safe(attemptToken)}/${safe(fileName)}`;

export const marketingVoucherExportManifestPath = (
  jobId: string,
  attemptToken: string,
) => `${ROOT}/${jobId}/results/${safe(attemptToken)}/manifest.json`;

export async function saveMarketingVoucherExportFile(
  path: string,
  buffer: Buffer,
  contentType: string,
) {
  await bucket()
    .file(path)
    .save(buffer, {
      resumable: buffer.byteLength > 5 * 1024 * 1024,
      metadata: { contentType, cacheControl: "private, max-age=0, no-store" },
    });
  return {
    path,
    checksum: createHash("sha256").update(buffer).digest("hex"),
    size_bytes: buffer.byteLength,
  };
}

export async function saveMarketingVoucherManifest(
  path: string,
  manifest: MarketingVoucherExportManifest,
) {
  const buffer = Buffer.from(JSON.stringify(manifest, null, 2));
  return saveMarketingVoucherExportFile(path, buffer, "application/json");
}

export async function createMarketingVoucherZip(input: {
  outputPath: string;
  manifest: MarketingVoucherExportManifest;
}) {
  const destination = bucket()
    .file(input.outputPath)
    .createWriteStream({
      resumable: true,
      metadata: {
        contentType: "application/zip",
        cacheControl: "private, max-age=0, no-store",
      },
    });
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const hash = createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    },
  });
  const completed = new Promise<void>((resolve, reject) => {
    destination.on("finish", resolve);
    destination.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(meter).pipe(destination);
  for (const part of input.manifest.files) {
    archive.append(bucket().file(part.storage_path).createReadStream(), {
      name: part.file_name,
    });
  }
  const manifestStream = new PassThrough();
  manifestStream.end(Buffer.from(JSON.stringify(input.manifest, null, 2)));
  archive.append(manifestStream, { name: "manifest.json" });
  await archive.finalize();
  await completed;
  return {
    path: input.outputPath,
    checksum: hash.digest("hex"),
    size_bytes: size,
  };
}

export async function copyMarketingVoucherExportFile(
  sourcePath: string,
  outputPath: string,
) {
  await bucket().file(sourcePath).copy(bucket().file(outputPath));
}

export async function createMarketingVoucherSignedUrl(
  path: string,
  fileName: string,
) {
  const ttlMinutes = Math.min(
    60,
    Math.max(1, Number(process.env.MARKETING_VOUCHER_SIGNED_URL_MINUTES ?? 15)),
  );
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const [url] = await bucket()
    .file(path)
    .getSignedUrl({
      action: "read",
      expires: expiresAt,
      responseDisposition: `attachment; filename="${safe(fileName)}"`,
    });
  return { url, expires_at: expiresAt };
}
