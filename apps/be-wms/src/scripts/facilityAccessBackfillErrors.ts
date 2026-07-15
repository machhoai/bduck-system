export class BackfillPreconditionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillPreconditionConflictError";
  }
}

export const isBackfillPreconditionConflict = (
  error: unknown,
): error is BackfillPreconditionConflictError =>
  error instanceof BackfillPreconditionConflictError;
