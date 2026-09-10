export function isMissingFirestoreIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  const code = Number(candidate.code);
  const detail = `${String(candidate.details ?? "")} ${String(candidate.message ?? "")}`;
  return code === 9 && /requires an index|failed_precondition/iu.test(detail);
}
