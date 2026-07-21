const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};
const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION || "dev";

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function GET() {
  const script = `
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

const firebaseConfig = ${escapeScriptJson(firebaseConfig)};
const BUILD_VERSION = ${escapeScriptJson(buildVersion)};
const STATIC_CACHE = "wms-static-" + BUILD_VERSION;
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest", "/logo/jw.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            key.startsWith("wms-") &&
            key !== STATIC_CACHE,
          )
          .map((key) => caches.delete(key)),
      ),
    ).then(() => clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  });
  return cached || network;
}

async function navigationWithOfflineFallback(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch {
    return (
      (await caches.match("/offline")) ||
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigationWithOfflineFallback(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (["image", "font", "style"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || "Joy World Cityfuns ERP";
    const options = {
      body: data.body || "",
      icon: "/logo/jw.png",
      badge: "/logo/jw.png",
      data: {
        actionUrl: data.action_url || "/dashboard",
        notificationId: data.notification_id || "",
      },
      tag: data.notification_id || undefined,
      renotify: Boolean(data.notification_id),
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || "/dashboard";
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url === targetUrl) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
