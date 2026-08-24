import { db } from "../config/firebase.js";

import {
  jobItemRef,
  jobRef,
  mapMarketingVoucherJob,
  mapMarketingVoucherJobItem,
} from "./marketingVoucherRepository.js";

export const failMarketingVoucherEmailJob = async (
  jobId: string,
  failure: { code: string; message: string },
) => {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef(jobId));
    if (!snapshot.exists) return;
    const previous = mapMarketingVoucherJob(snapshot);
    if (["COMPLETED", "PARTIAL", "CANCELLED"].includes(previous.status)) return;
    const processingSnapshot = await transaction.get(
      jobRef(jobId)
        .collection("items")
        .where("status", "==", "PROCESSING")
        .limit(3),
    );
    const processingItems = processingSnapshot.docs
      .map(mapMarketingVoucherJobItem)
      .filter((item) => !item.is_deleted);
    const now = new Date();
    processingItems.forEach((item) =>
      transaction.update(jobItemRef(jobId, item.id), {
        status: "FAILED",
        last_error_code: failure.code,
        last_error_message: failure.message.slice(0, 1_000),
        completed_at: now,
        updated_at: now,
        sync_time: now,
      }),
    );
    transaction.update(snapshot.ref, {
      status: "FAILED",
      progress: {
        ...previous.progress,
        processed: Math.min(
          previous.progress.total,
          previous.progress.processed + processingItems.length,
        ),
        failed: previous.progress.failed + processingItems.length,
      },
      last_error_code: failure.code,
      last_error_message: failure.message.slice(0, 1_000),
      revision: previous.revision + 1,
      updated_at: now,
      sync_time: now,
    });
  });
};
