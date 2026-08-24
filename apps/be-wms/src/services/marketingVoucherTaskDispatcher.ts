import { createHash } from "node:crypto";

import { CloudTasksClient } from "@google-cloud/tasks";

let client: CloudTasksClient | null = null;

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

const taskId = (jobId: string, revision: number) =>
  `voucher-${createHash("sha256")
    .update(`${jobId}:r${revision}`)
    .digest("hex")}`;

export const dispatchMarketingVoucherJob = async (input: {
  jobId: string;
  revision: number;
}) => {
  if (!marketingVoucherTasksConfigured()) {
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
