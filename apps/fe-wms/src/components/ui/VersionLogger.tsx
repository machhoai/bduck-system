"use client";

import { useEffect } from "react";

/**
 * VersionLogger — logs FE + BE build versions to browser console once on mount.
 * Fetches BE version from the health-check endpoint. Renders nothing in the DOM.
 */
export default function VersionLogger() {
  useEffect(() => {
    const feVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

    const logVersions = async () => {
      let beVersion = "unknown";
      try {
        const res = await fetch(`${apiUrl}/`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          beVersion = data.version ?? "unknown";
        }
      } catch {
        beVersion = "offline";
      }

      const tag =
        "font-weight:bold;padding:2px 6px;font-size:11px;border-radius:3px";

      console.info(
        "%c B.Duck WMS %c FE v" + feVersion + " %c BE v" + beVersion + " ",
        `background:#1d4ed8;color:#fff;${tag} border-radius:3px 0 0 3px`,
        `background:#0f172a;color:#7dd3fc;${tag} border-radius:0`,
        `background:#064e3b;color:#6ee7b7;${tag} border-radius:0 3px 3px 0`,
      );
    };

    logVersions();
  }, []);

  return null;
}
