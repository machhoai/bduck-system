import { Activity, Clock, Database, UserRound } from "lucide-react";
import type { AuditLog } from "@bduck/shared-types";

interface AuditLogStatsProps {
  total: number;
  visible: number;
  logs: AuditLog[];
  labels: {
    total: string;
    visible: string;
    entities: string;
    users: string;
  };
}

export function AuditLogStats({ total, visible, logs, labels }: AuditLogStatsProps) {
  const entityCount = new Set(logs.map((log) => log.entity_type)).size;
  const userCount = new Set(logs.map((log) => log.user_id)).size;

  const stats = [
    { label: labels.total, value: total, icon: Activity },
    { label: labels.visible, value: visible, icon: Clock },
    { label: labels.entities, value: entityCount, icon: Database },
    { label: labels.users, value: userCount, icon: UserRound },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
              <Icon size={19} />
            </div>
            <p className="text-[28px] font-semibold leading-[1.14] text-[var(--color-text-primary)]">
              {item.value}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}
