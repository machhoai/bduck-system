"use client";

import Link from "next/link";
import { ClipboardCheck, Clock3, Home } from "lucide-react";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/lib/i18n";

const BOOTSTRAP_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard", icon: Home },
  { href: "/tasks", labelKey: "tasks", icon: ClipboardCheck },
  { href: "/attendance", labelKey: "attendance", icon: Clock3 },
] as const;

export function DashboardBootstrapShell() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[var(--sidebar-width-expanded)] border-r border-white/10 bg-[var(--color-surface-nav)] p-3 lg:block">
        <div className="flex h-16 items-center justify-center text-lg font-semibold text-white">
          J-PULSE
        </div>
        <nav className="mt-2 grid gap-1">
          {BOOTSTRAP_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon size={18} />
                {t.nav[item.labelKey]}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen pb-[var(--bottomnav-height)] lg:ml-[var(--sidebar-width-expanded)] lg:pb-0" />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-frosted)] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden">
        <div className="flex h-[68px] items-center justify-around">
          {BOOTSTRAP_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 ${
                  active
                    ? "text-[var(--color-brand-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                <span className="text-xxs font-medium">
                  {t.nav[item.labelKey]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
