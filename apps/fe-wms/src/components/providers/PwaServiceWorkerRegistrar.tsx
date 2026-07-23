"use client";

import { useEffect } from "react";
import {
  isWmsCacheName,
  isWmsServiceWorkerUrl,
  shouldEnableWmsServiceWorker,
  WMS_SERVICE_WORKER_PATH,
} from "@/lib/pwaServiceWorkerPolicy";

const DEV_CLEANUP_RELOAD_KEY = "wms:pwa-dev-cleanup-reloaded";

function getRegistrationScriptUrl(registration: ServiceWorkerRegistration) {
  return (
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    null
  );
}

async function removeDevelopmentPwaState() {
  // A production worker remains registered until it is explicitly removed.
  const registrations = await navigator.serviceWorker.getRegistrations();
  const wmsRegistrations = registrations.filter((registration) =>
    isWmsServiceWorkerUrl(getRegistrationScriptUrl(registration)),
  );
  const unregisterResults = await Promise.all(
    wmsRegistrations.map((registration) => registration.unregister()),
  );

  if ("caches" in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(
      cacheNames
        .filter(isWmsCacheName)
        .map((cacheName) => window.caches.delete(cacheName)),
    );
  }

  return unregisterResults.some(Boolean);
}

export default function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (!shouldEnableWmsServiceWorker(process.env.NODE_ENV)) {
      const controlledByWmsWorker = isWmsServiceWorkerUrl(
        navigator.serviceWorker.controller?.scriptURL,
      );

      void removeDevelopmentPwaState()
        .then((removedRegistration) => {
          if (
            controlledByWmsWorker &&
            removedRegistration &&
            sessionStorage.getItem(DEV_CLEANUP_RELOAD_KEY) !== "1"
          ) {
            sessionStorage.setItem(DEV_CLEANUP_RELOAD_KEY, "1");
            window.location.reload();
            return;
          }

          if (!controlledByWmsWorker) {
            sessionStorage.removeItem(DEV_CLEANUP_RELOAD_KEY);
          }
        })
        .catch((error) => {
          console.warn("[PWA] development cleanup failed:", error);
        });
      return;
    }

    sessionStorage.removeItem(DEV_CLEANUP_RELOAD_KEY);

    void navigator.serviceWorker
      .register(WMS_SERVICE_WORKER_PATH, {
        scope: "/",
        updateViaCache: "none",
      })
      .catch((error) => {
        console.warn("[PWA] service worker registration failed:", error);
      });
  }, []);

  return null;
}
