"use client";

export const LOCAL_FIREBASE_TARGET_HEADER = "X-Local-Firebase-Target";
export const LOCAL_FIREBASE_TARGET_STORAGE_KEY = "bduck.local.firebase-target";

export const LOCAL_FIREBASE_TARGETS = [
  "test-jw-system",
  "jw-system-f2104",
] as const;

export type LocalFirebaseTarget = (typeof LOCAL_FIREBASE_TARGETS)[number];

export const isLocalFirebaseTargetSelectorEnabled =
  process.env.NODE_ENV === "development";

const defaultProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export function isLocalFirebaseTarget(
  value: unknown,
): value is LocalFirebaseTarget {
  return (
    typeof value === "string" &&
    LOCAL_FIREBASE_TARGETS.includes(value as LocalFirebaseTarget)
  );
}

export function getDefaultLocalFirebaseTarget(): LocalFirebaseTarget {
  return defaultProjectId === "jw-system-f2104"
    ? "jw-system-f2104"
    : "test-jw-system";
}

export function getSelectedLocalFirebaseTarget(): LocalFirebaseTarget {
  if (!isLocalFirebaseTargetSelectorEnabled || typeof window === "undefined") {
    return getDefaultLocalFirebaseTarget();
  }

  const storedTarget = window.localStorage.getItem(
    LOCAL_FIREBASE_TARGET_STORAGE_KEY,
  );
  return isLocalFirebaseTarget(storedTarget)
    ? storedTarget
    : getDefaultLocalFirebaseTarget();
}

export function saveSelectedLocalFirebaseTarget(
  target: LocalFirebaseTarget,
): void {
  if (!isLocalFirebaseTargetSelectorEnabled || typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_FIREBASE_TARGET_STORAGE_KEY, target);
}

function isBackendRequest(
  input: RequestInfo | URL,
  currentOrigin: string,
): boolean {
  const requestUrl =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input;

  try {
    const targetOrigin = new URL(requestUrl, currentOrigin).origin;
    const backendOrigin = new URL(apiBaseUrl, currentOrigin).origin;
    return targetOrigin === backendOrigin;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __bduckLocalFirebaseFetchInstalled?: boolean;
  }
}

export function installLocalFirebaseTargetFetch(): void {
  if (
    !isLocalFirebaseTargetSelectorEnabled ||
    typeof window === "undefined" ||
    window.__bduckLocalFirebaseFetchInstalled
  ) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isBackendRequest(input, window.location.origin)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set(LOCAL_FIREBASE_TARGET_HEADER, getSelectedLocalFirebaseTarget());
    return originalFetch(input, { ...init, headers });
  };
  window.__bduckLocalFirebaseFetchInstalled = true;
}
