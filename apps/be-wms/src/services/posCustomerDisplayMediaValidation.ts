import { createHash } from "crypto";

import type { PosCustomerDisplayMedia } from "@bduck/shared-types";

const IMAGE_LIMIT = 20 * 1024 * 1024;
const VIDEO_LIMIT = 10 * 1024 * 1024;

export class PosCustomerDisplayMediaError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly messages: { vi: string; zh: string },
  ) {
    super(messages.vi);
    this.name = "PosCustomerDisplayMediaError";
  }
}

const readUInt64BE = (buffer: Buffer, offset: number): number => {
  const high = buffer.readUInt32BE(offset);
  const low = buffer.readUInt32BE(offset + 4);
  return high * 2 ** 32 + low;
};

const findAtom = (buffer: Buffer, name: string, start = 0, end = buffer.length): Buffer | null => {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const atomName = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1 && offset + 16 <= end) {
      size = readUInt64BE(buffer, offset + 8);
      headerSize = 16;
    }
    if (size === 0) size = end - offset;
    if (size < headerSize || offset + size > end) break;
    if (atomName === name) return buffer.subarray(offset + headerSize, offset + size);
    offset += size;
  }
  return null;
};

const readMp4Duration = (buffer: Buffer): number | null => {
  const moov = findAtom(buffer, "moov");
  if (!moov) return null;
  const mvhd = findAtom(moov, "mvhd");
  if (!mvhd || mvhd.length < 20) return null;
  const version = mvhd.readUInt8(0);
  const timescaleOffset = version === 1 ? 20 : 12;
  const durationOffset = version === 1 ? 24 : 16;
  if (mvhd.length < durationOffset + (version === 1 ? 8 : 4)) return null;
  const timescale = mvhd.readUInt32BE(timescaleOffset);
  const duration = version === 1
    ? readUInt64BE(mvhd, durationOffset)
    : mvhd.readUInt32BE(durationOffset);
  return timescale > 0 ? duration / timescale : null;
};

const detectMimeType = (buffer: Buffer): PosCustomerDisplayMedia["mime_type"] | null => {
  if (buffer.length >= 12 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  return null;
};

export const sanitizeCustomerDisplayFileName = (fileName: string): string => {
  const sanitized = fileName
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|$]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return sanitized || "quang-cao";
};

export const inspectCustomerDisplayMedia = (buffer: Buffer): {
  type: PosCustomerDisplayMedia["type"];
  mimeType: PosCustomerDisplayMedia["mime_type"];
  extension: "jpg" | "png" | "webp" | "mp4";
  checksum: string;
  durationSeconds: number | null;
} => {
  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    throw new PosCustomerDisplayMediaError(400, {
      vi: "Tệp quảng cáo không đúng định dạng JPG, PNG, WEBP hoặc MP4.",
      zh: "广告文件必须是 JPG、PNG、WEBP 或 MP4 格式。",
    });
  }
  const isVideo = mimeType === "video/mp4";
  const sizeLimit = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
  if (buffer.length === 0 || buffer.length > sizeLimit) {
    throw new PosCustomerDisplayMediaError(413, {
      vi: isVideo ? "Video quảng cáo không được vượt quá 10 MB." : "Ảnh quảng cáo không được vượt quá 20 MB.",
      zh: isVideo ? "广告视频不得超过 10 MB。" : "广告图片不得超过 20 MB。",
    });
  }
  const durationSeconds = isVideo ? readMp4Duration(buffer) : null;
  if (isVideo && (!durationSeconds || durationSeconds > 15.05)) {
    throw new PosCustomerDisplayMediaError(400, {
      vi: "Video quảng cáo phải có thời lượng hợp lệ và không quá 15 giây.",
      zh: "广告视频时长必须有效且不得超过 15 秒。",
    });
  }
  const extension = mimeType === "image/jpeg"
    ? "jpg"
    : mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "mp4";
  return {
    type: isVideo ? "VIDEO" : "IMAGE",
    mimeType,
    extension,
    checksum: createHash("sha256").update(buffer).digest("hex"),
    durationSeconds,
  };
};
