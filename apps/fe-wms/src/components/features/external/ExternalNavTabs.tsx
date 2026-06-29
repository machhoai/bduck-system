"use client";

import Link from "next/link";
import { ClipboardList, ScanBarcode } from "lucide-react";

export default function ExternalNavTabs({ active }: { active: "queue" | "count" }) {
  const tabs = [
    { id: "queue", href: "/external/queue", label: "Queue", icon: ScanBarcode },
    { id: "count", href: "/external/count", label: "Count", icon: ClipboardList },
  ] as const;

  return (
    <div className="mb-3 flex items-center gap-2 border-b border-[var(--color-border-subtle)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
              isActive
                ? "text-[var(--color-brand-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            <span
              className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${
                isActive ? "bg-[var(--color-brand-primary)]" : "bg-transparent"
              }`}
            />
          </Link>
        );
      })}
    </div>
  );
}

