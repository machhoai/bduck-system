import { autoSubmitQueuedLocations } from "./externalScanService.js";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function startExternalQueueAutoSubmitWorker() {
  if (process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_ENABLED === "false") {
    console.info("[externalQueueAutoSubmit] disabled by env");
    return;
  }

  const intervalMs = parsePositiveInt(
    process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_INTERVAL_MS,
    60_000,
  );
  const olderThanMinutes = parsePositiveInt(
    process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_AFTER_MINUTES,
    30,
  );
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await autoSubmitQueuedLocations({
        actorId: "system:external-queue-auto-submit",
        olderThanMinutes,
      });
      if (result.submitted_batches > 0) {
        console.info(
          `[externalQueueAutoSubmit] submitted ${result.submitted_batches} batch(es), ${result.submitted_scans} scan(s)`,
        );
      }
    } catch (error) {
      console.error("[externalQueueAutoSubmit] failed", error);
    } finally {
      isRunning = false;
    }
  };

  setInterval(run, intervalMs);
  console.info(
    `[externalQueueAutoSubmit] running every ${intervalMs}ms, threshold ${olderThanMinutes} minute(s)`,
  );
}
