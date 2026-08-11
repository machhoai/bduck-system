import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCustomerDisplayMedia,
  PosCustomerDisplayMediaError,
  sanitizeCustomerDisplayFileName,
} from "./posCustomerDisplayMediaValidation.js";
import { posCustomerDisplaySettingsInputSchema } from "./posCustomerDisplaySchemas.js";

const atom = (name: string, payload: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(name, 4, 4, "ascii");
  return Buffer.concat([header, payload]);
};

const mp4WithDuration = (seconds: number): Buffer => {
  const ftyp = atom("ftyp", Buffer.from("isom"));
  const mvhdPayload = Buffer.alloc(20);
  mvhdPayload.writeUInt32BE(1_000, 12);
  mvhdPayload.writeUInt32BE(seconds * 1_000, 16);
  return Buffer.concat([ftyp, atom("moov", atom("mvhd", mvhdPayload))]);
};

test("detects supported image content from magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const result = inspectCustomerDisplayMedia(png);
  assert.equal(result.type, "IMAGE");
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.durationSeconds, null);
});

test("accepts MP4 at 15 seconds and rejects a longer video", () => {
  const accepted = inspectCustomerDisplayMedia(mp4WithDuration(15));
  assert.equal(accepted.type, "VIDEO");
  assert.equal(accepted.durationSeconds, 15);
  assert.throws(
    () => inspectCustomerDisplayMedia(mp4WithDuration(16)),
    PosCustomerDisplayMediaError,
  );
});

test("rejects untrusted file content and sanitizes file names", () => {
  assert.throws(() => inspectCustomerDisplayMedia(Buffer.from("not-media")), PosCustomerDisplayMediaError);
  assert.equal(sanitizeCustomerDisplayFileName(" ../promo:$?.mp4 "), ".._promo___.mp4");
});

test("playlist schema rejects duplicate media ids", () => {
  const mediaId = "00000000-0000-4000-8000-000000000001";
  const result = posCustomerDisplaySettingsInputSchema.safeParse({
    expected_version: 1,
    action_time: new Date().toISOString(),
    playlist: [0, 1].map((sort_order) => ({
      media_id: mediaId,
      sort_order,
      enabled: true,
      image_duration_seconds: 7,
    })),
  });
  assert.equal(result.success, false);
});
