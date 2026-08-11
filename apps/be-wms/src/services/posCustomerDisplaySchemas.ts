import { z } from "zod";

const actionTimeSchema = z.string().datetime({ offset: true });

export const posCustomerDisplayPlaylistItemSchema = z.object({
  media_id: z.string().uuid(),
  sort_order: z.number().int().min(0).max(9),
  enabled: z.boolean(),
  image_duration_seconds: z.number().min(3).max(15).nullable(),
});

export const posCustomerDisplaySettingsInputSchema = z
  .object({
    expected_version: z.number().int().nonnegative(),
    playlist: z.array(posCustomerDisplayPlaylistItemSchema).max(10),
    action_time: actionTimeSchema,
  })
  .superRefine((value, context) => {
    const ids = value.playlist.map((item) => item.media_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["playlist"],
        message: "Playlist contains duplicate media",
      });
    }
  });

export const posCustomerDisplayMutationSchema = z.object({
  expected_version: z.number().int().nonnegative(),
  action_time: actionTimeSchema,
});

export const posCustomerDisplayMediaParamsSchema = z.object({
  mediaId: z.string().uuid(),
});

export const posCustomerDisplayUploadHeadersSchema = z.object({
  "x-file-name": z.string().trim().min(1).max(255),
  "x-expected-version": z.coerce.number().int().nonnegative(),
  "x-action-time": actionTimeSchema,
});

export const posCustomerDisplayDeviceHeadersSchema = z.object({
  "x-pos-device-id": z.string().uuid(),
  "x-pos-device-credential": z.string().min(32).max(200),
});
