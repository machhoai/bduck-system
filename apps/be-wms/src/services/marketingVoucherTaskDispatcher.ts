import { createHash } from "node:crypto";

import { resolveMarketingVouchersFeatureEnabled } from "@bduck/shared-types";
import { CloudTasksClient } from "@google-cloud/tasks";

import {
  db,
  defaultLocalFirebaseTarget,
  isLocalFirebaseTargetConfigured,
} from "../config/firebase.js";
import {
  getRequestLocalFirebaseTarget,
  LOCAL_FIREBASE_TARGETS,
  runWithLocalFirebaseTarget,
} from "../config/firebaseTargetContext.js";

let client: CloudTasksClient | null = null;
const scheduledLocalJobs = new Set<string>();
const rerunLocalJobs = new Set<string>();
const LOCAL_RECOVERY_INTERVAL_MS = 15_000;

const getClient = () => {
  client ??= new CloudTasksClient();
  return client;
};

export const marketingVoucherTaskConfig = () => ({
  projectId:
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
  location: process.env.MARKETING_VOUCHER_TASK_LOCATION ?? "",
  queue: process.env.MARKETING_VOUCHER_TASK_QUEUE ?? "",
  workerBaseUrl: (process.env.MARKETING_VOUCHER_WORKER_BASE_URL ?? "").replace(
    /\/+$/u,
    "",
  ),
  serviceAccountEmail:
    process.env.MARKETING_VOUCHER_WORKER_SERVICE_ACCOUNT ?? "",
  workerSecret: process.env.MARKETING_VOUCHER_WORKER_SECRET ?? "",
});

export const marketingVoucherTasksConfigured = () => {
  const config = marketingVoucherTaskConfig();
  return Boolean(
    config.projectId &&
    config.location &&
    config.queue &&
    config.workerBaseUrl &&
    config.serviceAccountEmail &&
    config.workerSecret,
  );
};

export const marketingVoucherLocalWorkerEnabled = (
  nodeEnv = process.env.NODE_ENV,
  configuredValue = process.env.MARKETING_VOUCHER_LOCAL_WORKER_ENABLED,
) =>
  nodeEnv !== "production" &&
  resolveMarketingVouchersFeatureEnabled(configuredValue);

const dispatchMarketingVoucherJobLocally = (
  jobId: string,
  target = getRequestLocalFirebaseTarget(defaultLocalFirebaseTarget),
) => {
  const localJobKey = `${target}:${jobId}`;
  if (scheduledLocalJobs.has(localJobKey)) {
    rerunLocalJobs.add(localJobKey);
    return;
  }
  scheduledLocalJobs.add(localJobKey);
  setImmediate(() => {
    void runWithLocalFirebaseTarget(target, async () => {
      const { processMarketingVoucherJob } = await import(
        "./marketingVoucherJobService.js"
      );
      await processMarketingVoucherJob(jobId);
    })
      .catch((error: unknown) => {
        console.error("MARKETING_VOUCHER_LOCAL_WORKER_FAILED", {
          job_id: jobId,
          error,
        });
      })
      .finally(() => {
        scheduledLocalJobs.delete(localJobKey);
        if (rerunLocalJobs.delete(localJobKey)) {
          dispatchMarketingVoucherJobLocally(jobId, target);
        }
      });
  });
};

const recoverMarketingVoucherJobsForTarget = async (
  target: (typeof LOCAL_FIREBASE_TARGETS)[number],
) =>
  runWithLocalFirebaseTarget(target, async () => {
    const snapshots = await Promise.all(
      ["QUEUED", "PROCESSING"].map((status) =>
        db
          .collection("marketing_voucher_jobs")
          .where("status", "==", status)
          .limit(50)
          .get(),
      ),
    );
    snapshots.forEach((snapshot) => {
      snapshot.docs
        .filter((job) => job.get("is_deleted") !== true)
        .slice(0, 20)
        .forEach((job) => dispatchMarketingVoucherJobLocally(job.id));
    });
  });

export const recoverLocalMarketingVoucherJobs = async () => {
  if (!marketingVoucherLocalWorkerEnabled()) return;
  await Promise.all(
    LOCAL_FIREBASE_TARGETS.filter(isLocalFirebaseTargetConfigured).map(
      recoverMarketingVoucherJobsForTarget,
    ),
  );
};

export const startLocalMarketingVoucherWorkerRecovery = () => {
  if (!marketingVoucherLocalWorkerEnabled()) return;
  const recover = () => {
    void recoverLocalMarketingVoucherJobs().catch((error: unknown) => {
      console.error("MARKETING_VOUCHER_LOCAL_RECOVERY_FAILED", error);
    });
  };
  recover();
  const interval = setInterval(recover, LOCAL_RECOVERY_INTERVAL_MS);
  interval.unref();
  console.info("[marketing-vouchers] local worker recovery enabled");
};

const taskId = (jobId: string, revision: number) =>
  `voucher-${createHash("sha256")
    .update(`${jobId}:r${revision}`)
    .digest("hex")}`;

export const dispatchMarketingVoucherJob = async (input: {
  jobId: string;
  revision: number;
}) => {
  if (!marketingVoucherTasksConfigured()) {
    if (marketingVoucherLocalWorkerEnabled()) {
      dispatchMarketingVoucherJobLocally(input.jobId);
      return { mode: "LOCAL_WORKER" as const };
    }
    return { mode: "SCHEDULER_FALLBACK" as const };
  }
  const config = marketingVoucherTaskConfig();
  const tasks = getClient();
  const parent = tasks.queuePath(
    config.projectId,
    config.location,
    config.queue,
  );
  const name = tasks.taskPath(
    config.projectId,
    config.location,
    config.queue,
    taskId(input.jobId, input.revision),
  );
  const url = `${config.workerBaseUrl}/api/marketing-vouchers/internal/jobs/${encodeURIComponent(input.jobId)}/process`;
  try {
    await tasks.createTask({
      parent,
      task: {
        name,
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            "X-Marketing-Voucher-Worker-Secret": config.workerSecret,
          },
          body: Buffer.from("{}").toString("base64"),
          oidcToken: {
            serviceAccountEmail: config.serviceAccountEmail,
            audience: config.workerBaseUrl,
          },
        },
      },
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 6) throw error;
  }
  return { mode: "CLOUD_TASKS" as const, task_name: name };
};
