/**
 * Timer Abstraction for Workflow Engine
 *
 * PLACEHOLDER: This function does NOT use setTimeout/setInterval.
 * In production, it will be integrated with:
 *   - Google Cloud Tasks (for scheduled task execution)
 *   - OR Firebase Cloud Functions with a scheduled trigger
 *   - OR a message queue (BullMQ, Pub/Sub, etc.)
 *
 * When the timer fires, the callback endpoint should call:
 *   workflowEngineService.advanceFromTimer(instanceId, taskId)
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
  // TODO: Integrate with Google Cloud Tasks or a job queue.
  // Example Cloud Tasks payload:
  // {
  //   httpMethod: "POST",
  //   url: `${process.env.BE_WMS_URL}/api/workflows/engine/timer-callback`,
  //   body: JSON.stringify({ instance_id: instanceId, task_id: taskId }),
  //   scheduleTime: targetTime.toISOString(),
  // }

  console.log(
    `[workflowTimer] PLACEHOLDER: Scheduled timer for instance=${instanceId}, ` +
      `task=${taskId}, fires at ${targetTime.toISOString()}`,
  );
}

/**
 * Cancel a previously scheduled timer task.
 * Used when a workflow instance is cancelled before the timer fires.
 */
export async function cancelTimerTask(
  instanceId: string,
  taskId: string,
): Promise<void> {
  // TODO: Delete the Cloud Tasks entry for this instanceId + taskId
  console.log(
    `[workflowTimer] PLACEHOLDER: Cancelled timer for instance=${instanceId}, task=${taskId}`,
  );
}
