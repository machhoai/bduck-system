"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import {
  PERMISSION_GROUPS,
  PERMISSION_REGISTRY,
  type PermissionDefinition,
  type PermissionGroup,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { RoleManagementPanel } from "@/components/roles/RoleManagementPanel";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { UserManagementPanel } from "./UserManagementPanel";

type IdentityTabId = "users" | "roles";

interface IdentityTab {
  id: IdentityTabId;
  group: PermissionGroup;
  permissions: PermissionDefinition[];
  readKey: string;
  writeKey: string;
  icon: LucideIcon;
}

const IDENTITY_GROUP_IDS: IdentityTabId[] = ["users", "roles"];
const ICONS: Record<IdentityTabId, LucideIcon> = {
  users: Users,
  roles: ShieldCheck,
};

function getPermissionKey(groupId: IdentityTabId, action: "read" | "write") {
  return (
    PERMISSION_REGISTRY.find(
      (permission) =>
        permission.group === groupId && permission.key.endsWith(`.${action}`),
    )?.key || `${groupId}.${action}`
  );
}

function buildIdentityTabs(): IdentityTab[] {
  return PERMISSION_GROUPS.filter(
    (group): group is PermissionGroup & { id: IdentityTabId } =>
      IDENTITY_GROUP_IDS.includes(group.id as IdentityTabId),
  )
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      id: group.id,
      group,
      permissions: PERMISSION_REGISTRY.filter(
        (permission) => permission.group === group.id,
      ),
      readKey: getPermissionKey(group.id, "read"),
      writeKey: getPermissionKey(group.id, "write"),
      icon: ICONS[group.id],
    }));
}

export function UserAccessWorkspace() {
  const { t, lang } = useTranslation();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<IdentityTabId>("users");

  const tabs = useMemo(buildIdentityTabs, []);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => hasPermission(tab.readKey)),
    [hasPermission, tabs],
  );

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  const activePanel = visibleTabs.find((tab) => tab.id === activeTab);

  if (!isAuthenticated) {
    return <UserAccessSkeleton />;
  }

  if (!activePanel) {
    return (
      <section className="space-y-6">
        <WorkspaceHero
          title={t.identity.title}
          subtitle={t.identity.subtitle}
          badge={t.identity.badge}
        />
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white px-5 py-12 text-center">
          <LockKeyhole
            size={42}
            className="mb-3 text-[var(--color-text-muted)]"
          />
          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            {t.identity.noAccessTitle}
          </h2>
          <p className="mt-2 max-w-md text-[15px] leading-6 text-[var(--color-text-muted)]">
            {t.identity.noAccessHint}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <WorkspaceHero
        title={t.identity.title}
        subtitle={t.identity.subtitle}
        badge={t.identity.badge}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleTabs.map((tab) => (
          <AccessSummaryCard
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            canWrite={hasPermission(tab.writeKey)}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-1">
          {visibleTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm md:p-6">
        {activePanel.id === "users" ? (
          <UserManagementPanel isEmbedded />
        ) : (
          <RoleManagementPanel isEmbedded />
        )}
      </div>
    </section>
  );

  function AccessSummaryCard({
    tab,
    active,
    canWrite,
    onClick,
  }: {
    tab: IdentityTab;
    active: boolean;
    canWrite: boolean;
    onClick: () => void;
  }) {
    const Icon = tab.icon;
    const readPermission = tab.permissions.find(
      (permission) => permission.key === tab.readKey,
    );
    const writePermission = tab.permissions.find(
      (permission) => permission.key === tab.writeKey,
    );

    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-h-32 rounded-[var(--radius-lg)] border bg-white p-4 text-left transition-all active:scale-[0.99] ${
          active
            ? "border-[var(--color-brand-primary)] shadow-sm"
            : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-focus)]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <Icon size={21} />
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              canWrite
                ? "border-[var(--color-accent-success)] text-[var(--color-accent-success)]"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)]"
            }`}
          >
            {canWrite ? t.identity.writeAccess : t.identity.readOnly}
          </span>
        </div>
        <h2 className="mt-4 text-[20px] font-semibold leading-7 text-[var(--color-text-primary)]">
          {tab.group.label[lang]}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-muted)]">
          {(canWrite ? writePermission : readPermission)?.description[lang] ||
            tab.permissions[0]?.description[lang]}
        </p>
      </button>
    );
  }

  function TabButton({
    tab,
    active,
    onClick,
  }: {
    tab: IdentityTab;
    active: boolean;
    onClick: () => void;
  }) {
    const Icon = tab.icon;

    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold transition-all active:scale-[0.98] ${
          active
            ? "bg-[var(--color-surface-nav)] text-white"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
        }`}
      >
        <Icon size={17} />
        <span className="truncate">{tab.group.label[lang]}</span>
      </button>
    );
  }
}

function WorkspaceHero({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-5 py-6 md:px-7 md:py-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
            <KeyRound size={14} />
            {badge}
          </span>
          <h1 className="mt-4 font-[var(--font-display)] text-[32px] font-semibold leading-tight tracking-normal text-[var(--color-text-primary)] md:text-[42px]">
            {title}
          </h1>
          <p className="mt-3 text-[16px] leading-7 text-[var(--color-text-secondary)] md:text-[17px]">
            {subtitle}
          </p>
        </div>
        <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-nav)] text-white md:flex">
          <UserCog size={34} />
        </div>
      </div>
    </header>
  );
}

function UserAccessSkeleton() {
  return (
    <section className="space-y-6">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-6">
        <Skeleton variant="text" className="h-5 w-32" />
        <Skeleton variant="text" className="mt-5 h-10 w-72" />
        <Skeleton variant="text" className="mt-4 h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-32 rounded-[var(--radius-lg)]" />
      </div>
      <Skeleton className="h-96 rounded-[var(--radius-lg)]" />
    </section>
  );
}
