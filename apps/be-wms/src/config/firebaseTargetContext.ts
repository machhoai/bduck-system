import { AsyncLocalStorage } from "node:async_hooks";

export const LOCAL_FIREBASE_TARGET_HEADER = "X-Local-Firebase-Target";

export const LOCAL_FIREBASE_TARGETS = [
  "test-jw-system",
  "jw-system-f2104",
] as const;

export type LocalFirebaseTarget = (typeof LOCAL_FIREBASE_TARGETS)[number];

const firebaseTargetContext = new AsyncLocalStorage<LocalFirebaseTarget>();

export function isLocalFirebaseTarget(
  value: unknown,
): value is LocalFirebaseTarget {
  return (
    typeof value === "string" &&
    LOCAL_FIREBASE_TARGETS.includes(value as LocalFirebaseTarget)
  );
}

export function isLocalFirebaseTargetSelectionEnabled(
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "development";
}

export function getRequestLocalFirebaseTarget(
  fallback: LocalFirebaseTarget,
): LocalFirebaseTarget {
  return firebaseTargetContext.getStore() ?? fallback;
}

export function runWithLocalFirebaseTarget<T>(
  target: LocalFirebaseTarget,
  callback: () => T,
): T {
  return firebaseTargetContext.run(target, callback);
}
