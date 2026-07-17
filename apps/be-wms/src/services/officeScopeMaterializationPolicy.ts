export interface OfficeScopeMaterializationJobState {
  requestedUserIds: readonly string[];
  completedUserIds: readonly string[];
  failedUserIds: readonly string[];
  errors: Readonly<Record<string, string>>;
}

export const createInitialOfficeScopeMaterializationState = (
  requestedCount: number,
) => ({
  status: requestedCount === 0 ? ("COMPLETED" as const) : ("PENDING" as const),
  requestedCount,
  completedCount: 0,
  failedCount: 0,
  attempts: requestedCount === 0 ? 0 : 1,
});

export const resolveOfficeScopeMaterializationProgress = (
  state: OfficeScopeMaterializationJobState,
  attemptedUserIds: readonly string[],
  failures: readonly { userId: string; error: string }[],
) => {
  const attempted = new Set(attemptedUserIds);
  const failedByUser = new Map(
    failures.map((failure) => [failure.userId, failure.error]),
  );
  const completed = new Set(state.completedUserIds);
  attempted.forEach((userId) => {
    if (!failedByUser.has(userId)) completed.add(userId);
  });
  const failed = new Set(
    state.failedUserIds.filter((userId) => !attempted.has(userId)),
  );
  failedByUser.forEach((_, userId) => failed.add(userId));
  const errors = { ...state.errors };
  attempted.forEach((userId) => delete errors[userId]);
  failedByUser.forEach((error, userId) => {
    errors[userId] = error.slice(0, 1000);
  });
  const unprocessedUserIds = state.requestedUserIds.filter(
    (userId) => !completed.has(userId) && !failed.has(userId),
  );
  const status =
    unprocessedUserIds.length > 0
      ? "PENDING"
      : failed.size > 0
        ? "FAILED"
        : "COMPLETED";
  return {
    status,
    completedUserIds: Array.from(completed).sort(),
    failedUserIds: Array.from(failed).sort(),
    unprocessedUserIds: [...unprocessedUserIds].sort(),
    errors,
  } as const;
};
