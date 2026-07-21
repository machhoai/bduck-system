"use client";

import { useEffect } from "react";

export default function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    void navigator.serviceWorker
      .register("/firebase-messaging-sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch((error) => {
        console.warn("[PWA] service worker registration failed:", error);
      });
  }, []);

  return null;
}
