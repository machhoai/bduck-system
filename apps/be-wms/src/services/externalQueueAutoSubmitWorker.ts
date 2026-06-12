import { autoSubmitQueuedLocations } from "./externalScanService.js";
import {
  claimAutoSubmitScheduleRun,
  completeAutoSubmitScheduleRun,
  getAutoSubmitSchedule,
  getGmt7ScheduleCandidate,
} from "./externalQueueAutoSubmitConfigService.js";

const CHECK_INTERVAL_MS = 30_000;

export function startExternalQueueAutoSubmitWorker() {
  if (process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_WORKER_ENABLED !== "true") {
    console.info(
      "[externalQueueAutoSubmit] in-process checker disabled; use Cloud Scheduler",
    );
    return;
  }

  let isRunning = false;

  const checkSchedule = async () => {
    if (isRunning) return;

    try {
      const schedule = await getAutoSubmitSchedule();
      if (!schedule.enabled) return;

      const candidate = getGmt7ScheduleCandidate();
      if (!schedule.times.includes(candidate.time)) return;

      const claimed = await claimAutoSubmitScheduleRun(
        candidate.runKey,
        candidate.time,
      );
      if (!claimed) return;

      isRunning = true;
      console.info(
        `[externalQueueAutoSubmit] running scheduled submit for ${candidate.label}`,
      );

      const result = await autoSubmitQueuedLocations({
        actorId: "system:external-queue-auto-submit",
      });

      await completeAutoSubmitScheduleRun(candidate.runKey, {
        submitted_batches: result.submitted_batches,
        submitted_scans: result.submitted_scans,
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

  const interval = setInterval(checkSchedule, CHECK_INTERVAL_MS);
  void checkSchedule();
  console.info(
    "[externalQueueAutoSubmit] schedule checker started, timezone GMT+7",
  );

  return () => clearInterval(interval);
}
