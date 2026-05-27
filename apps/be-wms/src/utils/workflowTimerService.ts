/**
 * Workflow Timer Service — Google Cloud Tasks Integration
 *
 * ═══════════════════════════════════════════════════════════════
 * When the engine hits a TIMER node, this service creates a
 * Cloud Tasks entry that fires at `scheduleTime`. When the task
 * fires, Cloud Tasks will POST to:
 *
 *   POST /api/workflows/engine/timer-callback
 *   Body: { instance_id: "...", task_id: "..." }
 *
 * The callback endpoint (already implemented in Phase 3) calls
 * `workflowEngineService.advanceFromTimer()` to resume traversal.
 *
 * ENVIRONMENT VARIABLES (required in .env):
 *   GCLOUD_PROJECT_ID       — GCP project ID
 *   GCLOUD_LOCATION         — Cloud Tasks region (e.g. "asia-southeast1")
 *   GCLOUD_TASKS_QUEUE      — Queue name (e.g. "workflow-timers")
 *   BE_WMS_SERVICE_URL      — Public URL of this service (e.g. "https://api.wms.example.com")
 *   GCLOUD_TASKS_SA_EMAIL   — Service account email for OIDC auth (optional)
 *
 * FALLBACK: If env vars are missing, falls back to console.log
 * (same as the placeholder behavior) so dev environments don't crash.
 * ═══════════════════════════════════════════════════════════════
 */

import { CloudTasksClient, protos } from "@google-cloud/tasks";

const PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
const LOCATION = process.env.GCLOUD_LOCATION || "asia-southeast1";
const QUEUE_NAME = process.env.GCLOUD_TASKS_QUEUE || "workflow-timers";
const SERVICE_URL = process.env.BE_WMS_SERVICE_URL;
const SA_EMAIL = process.env.GCLOUD_TASKS_SA_EMAIL;

/** Lazy-initialized Cloud Tasks client (avoids import errors in dev) */
let client: CloudTasksClient | null = null;

function getClient(): CloudTasksClient {
  if (!client) {
    client = new CloudTasksClient();
  }
  return client;
}

function isConfigured(): boolean {
  return Boolean(PROJECT_ID && SERVICE_URL);
}

/**
 * Schedule a timer task via Google Cloud Tasks.
 *
 * @param instanceId - The workflow instance being processed
 * @param taskId     - The specific timer task to complete
 * @param targetTime - When the timer should fire
 */
export async function scheduleTimerTask(
  instanceId: string,
  taskId: string,
  targetTime: Date,
): Promise<void> {
  if (!isConfigured()) {
    // Fallback for local development
    console.log(
      `[workflowTimer] DEV FALLBACK: Scheduled timer for instance=${instanceId}, ` +
        `task=${taskId}, fires at ${targetTime.toISOString()}. ` +
        `Set GCLOUD_PROJECT_ID and BE_WMS_SERVICE_URL to enable Cloud Tasks.`,
    );
    return;
  }

  const parent = getClient().queuePath(PROJECT_ID!, LOCATION, QUEUE_NAME);
  const callbackUrl = `${SERVICE_URL}/api/workflows/engine/timer-callback`;

  const payload = JSON.stringify({
    instance_id: instanceId,
    task_id: taskId,
  });

  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: "POST",
      url: callbackUrl,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(payload).toString("base64"),
      ...(SA_EMAIL && {
        oidcToken: {
          serviceAccountEmail: SA_EMAIL,
          audience: SERVICE_URL,
        },
      }),
    },
    scheduleTime: {
      seconds: Math.floor(targetTime.getTime() / 1000),
      nanos: (targetTime.getTime() % 1000) * 1e6,
    },
    // Use a deterministic name to prevent duplicate tasks
    name: `${parent}/tasks/wf-${instanceId}-${taskId}`.slice(0, 500),
  };

  try {
    await getClient().createTask({ parent, task });
    console.log(
      `[workflowTimer] Scheduled Cloud Task: instance=${instanceId}, ` +
        `task=${taskId}, fires at ${targetTime.toISOString()}`,
    );
  } catch (error) {
    // If the task already exists (ALREADY_EXISTS), it's a duplicate — safe to ignore
    const grpcError = error as { code?: number };
    if (grpcError.code === 6) {
      // 6 = ALREADY_EXISTS
      console.log(
        `[workflowTimer] Task already exists (idempotent): instance=${instanceId}, task=${taskId}`,
      );
      return;
    }
    console.error("[workflowTimer] Failed to schedule Cloud Task:", error);
    throw error;
  }
}

/**
 * Cancel a previously scheduled timer task.
 * Used when a workflow instance is cancelled before the timer fires.
 */
export async function cancelTimerTask(
  instanceId: string,
  taskId: string,
): Promise<void> {
  if (!isConfigured()) {
    console.log(
      `[workflowTimer] DEV FALLBACK: Cancelled timer for instance=${instanceId}, task=${taskId}`,
    );
    return;
  }

  const parent = getClient().queuePath(PROJECT_ID!, LOCATION, QUEUE_NAME);
  const taskName = `${parent}/tasks/wf-${instanceId}-${taskId}`;

  try {
    await getClient().deleteTask({ name: taskName });
    console.log(
      `[workflowTimer] Cancelled Cloud Task: instance=${instanceId}, task=${taskId}`,
    );
  } catch (error) {
    const grpcError = error as { code?: number };
    if (grpcError.code === 5) {
      // 5 = NOT_FOUND — task may have already fired or been cancelled
      console.log(
        `[workflowTimer] Task not found (already fired/cancelled): instance=${instanceId}, task=${taskId}`,
      );
      return;
    }
    console.error("[workflowTimer] Failed to cancel Cloud Task:", error);
    throw error;
  }
}
