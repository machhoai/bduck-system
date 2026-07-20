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

export const dispatchInvoiceIssueItem = async (input: {
  jobId: string;
  itemId: string;
  attempt: number;
  scheduleAt?: Date;
}) => {
  if (!cloudTasksConfigured()) return { mode: "SCHEDULER_FALLBACK" as const };
  const config = invoiceTaskConfig();
  const tasks = getClient();
  const parent = tasks.queuePath(config.projectId, config.location, config.queue);
  const name = tasks.taskPath(
    config.projectId,
    config.location,
    config.queue,
    taskSegment(`${input.jobId}-${input.itemId}-a${input.attempt}`),
  );
  const url = `${config.workerBaseUrl}/api/invoices/internal/issues/${encodeURIComponent(input.jobId)}/items/${encodeURIComponent(input.itemId)}/process`;
  try {
    await tasks.createTask({
      parent,
      task: {
        name,
        scheduleTime: input.scheduleAt
          ? { seconds: Math.floor(input.scheduleAt.getTime() / 1000) }
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
