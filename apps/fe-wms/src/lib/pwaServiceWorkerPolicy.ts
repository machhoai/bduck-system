export const WMS_SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
export const WMS_CACHE_PREFIX = "wms-";

export function shouldEnableWmsServiceWorker(environment: string | undefined) {
  return environment === "production";
}

export function isWmsServiceWorkerUrl(scriptUrl: string | null | undefined) {
  if (!scriptUrl) return false;

  try {
    return new URL(scriptUrl).pathname === WMS_SERVICE_WORKER_PATH;
  } catch {
    return false;
  }
}

export function isWmsCacheName(cacheName: string) {
  return cacheName.startsWith(WMS_CACHE_PREFIX);
}
