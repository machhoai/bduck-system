import { createHash } from "node:crypto";

import { CloudTasksClient } from "@google-cloud/tasks";

let client: CloudTasksClient | null = null;

const getClient = () => {
  client ??= new CloudTasksClient();
  return client;
};

export const invoiceTaskConfig = () => ({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
  location: process.env.MEINVOICE_TASK_LOCATION ?? "",
  queue: process.env.MEINVOICE_TASK_QUEUE ?? "",
  workerBaseUrl: (process.env.MEINVOICE_WORKER_BASE_URL ?? "").replace(/\/+$/u, ""),
  serviceAccountEmail: process.env.MEINVOICE_WORKER_SERVICE_ACCOUNT ?? "",
  workerSecret: process.env.MEINVOICE_WORKER_SECRET ?? "",
});

export const cloudTasksConfigured = () => {
  const config = invoiceTaskConfig();
  return Boolean(
    config.projectId && config.location && config.queue &&
    config.workerBaseUrl && config.serviceAccountEmail && config.workerSecret,
  );
};

const taskSegment = (value: string) =>
  `meinvoice-${createHash("sha256").update(value).digest("hex")}`;

export const invoiceIssueTaskId = (input: {
  jobId: string;
  itemId: string;
  attempt: number;
  deduplicationKey?: string;
}) =>
  taskSegment(
    [
      input.jobId,
      input.itemId,
      `a${input.attempt}`,
      input.deduplicationKey,
    ]
      .filter((value): value is string => Boolean(value))
      .join("-"),
  );

/**
 * Cloud Tasks receives second precision here. Round up so a retry cannot be
 * dispatched before the Firestore `next_attempt_at` guard allows it to run.
 */
export const invoiceTaskScheduleTime = (scheduleAt: Date) => {
  const milliseconds = scheduleAt.getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new Error("MEINVOICE_TASK_SCHEDULE_TIME_INVALID");
  }
  return { seconds: Math.ceil(milliseconds / 1_000) };
};

export const dispatchInvoiceIssueItem = async (input: {
  jobId: string;
  itemId: string;
  attempt: number;
  scheduleAt?: Date;
  deduplicationKey?: string;
}) => {
  if (!cloudTasksConfigured()) return { mode: "SCHEDULER_FALLBACK" as const };
  const config = invoiceTaskConfig();
  const tasks = getClient();
  const parent = tasks.queuePath(config.projectId, config.location, config.queue);
  const name = tasks.taskPath(
    config.projectId,
    config.location,
    config.queue,
    invoiceIssueTaskId(input),
  );
  const url = `${config.workerBaseUrl}/api/invoices/internal/issues/${encodeURIComponent(input.jobId)}/items/${encodeURIComponent(input.itemId)}/process`;
  try {
    await tasks.createTask({
      parent,
      task: {
        name,
        scheduleTime: input.scheduleAt
          ? invoiceTaskScheduleTime(input.scheduleAt)
          : undefined,
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            "X-MeInvoice-Worker-Secret": config.workerSecret,
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
    const code = (error as { code?: number }).code;
    if (code !== 6) throw error;
  }
  return { mode: "CLOUD_TASKS" as const, task_name: name };
};
