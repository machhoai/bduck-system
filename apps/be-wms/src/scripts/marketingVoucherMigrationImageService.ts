import { randomUUID } from "node:crypto";

import type { Storage } from "firebase-admin/storage";

import { migrationSha256 } from "./marketingVoucherMigrationPolicy.js";
import type { MigrationImageResult } from "./marketingVoucherMigrationTypes.js";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const extensionFor = (contentType: string): string => {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  throw new Error(`LEGACY_IMAGE_TYPE_BLOCKED:${contentType}`);
};

const downloadLegacyImage = async (
  sourceUrl: string,
): Promise<{ bytes: Buffer; contentType: string; checksum: string }> => {
  const response = await fetch(sourceUrl, { redirect: "follow" });
  if (!response.ok)
    throw new Error(`LEGACY_IMAGE_DOWNLOAD_FAILED:${response.status}`);
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!allowedContentTypes.has(contentType)) {
    throw new Error(`LEGACY_IMAGE_TYPE_BLOCKED:${contentType || "missing"}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`LEGACY_IMAGE_SIZE_INVALID:${bytes.length}`);
  }
  return { bytes, contentType, checksum: migrationSha256(bytes) };
};

const downloadUrl = (bucket: string, path: string, token: string): string =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

export const migrateLegacyCampaignImage = async (input: {
  campaignId: string;
  sourceUrl: string | null;
  targetStorage: Storage | null;
  targetBucketName: string | null;
  migrationId: string;
  writeTarget: boolean;
}): Promise<MigrationImageResult> => {
  if (!input.sourceUrl) {
    return {
      storage_path: null,
      download_url: null,
      source_sha256: null,
      target_sha256: null,
      error: null,
    };
  }
  try {
    const source = await downloadLegacyImage(input.sourceUrl);
    if (!input.targetStorage || !input.targetBucketName) {
      return {
        storage_path: null,
        download_url: null,
        source_sha256: source.checksum,
        target_sha256: null,
        error: null,
      };
    }
    const extension = extensionFor(source.contentType);
    const path = `marketing-vouchers/campaign-images/${input.campaignId}/legacy-${source.checksum}.${extension}`;
    const bucket = input.targetStorage.bucket(input.targetBucketName);
    const file = bucket.file(path);
    const [exists] = await file.exists();
    let token: string = randomUUID();
    if (exists) {
      const [metadata] = await file.getMetadata();
      token = String(metadata.metadata?.firebaseStorageDownloadTokens ?? token)
        .split(",")[0]!
        .trim();
    } else if (input.writeTarget) {
      await file.save(source.bytes, {
        resumable: false,
        contentType: source.contentType,
        metadata: {
          cacheControl: "public,max-age=31536000,immutable",
          metadata: {
            firebaseStorageDownloadTokens: token,
            migrationId: input.migrationId,
            sha256: source.checksum,
          },
        },
      });
    } else {
      throw new Error("MIGRATED_IMAGE_NOT_FOUND");
    }
    const [targetBytes] = await file.download();
    const targetChecksum = migrationSha256(targetBytes);
    if (targetChecksum !== source.checksum) {
      throw new Error("MIGRATED_IMAGE_CHECKSUM_MISMATCH");
    }
    return {
      storage_path: path,
      download_url: downloadUrl(input.targetBucketName, path, token),
      source_sha256: source.checksum,
      target_sha256: targetChecksum,
      error: null,
    };
  } catch (error) {
    return {
      storage_path: null,
      download_url: null,
      source_sha256: null,
      target_sha256: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
