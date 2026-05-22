'use client';

import { useTranslation } from '../../../lib/i18n';
import { useUserStore } from '../../../stores/useUserStore';

/**
 * Dashboard Page — Trang chủ placeholder
 *
 * ► Hiển thị lời chào + empty state
 * ► Nội dung thực sẽ bổ sung sau (KPI cards, charts, v.v.)
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t.dashboard.welcome}, {user?.full_name?.split(' ').pop() || ''}! 👋
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {t.dashboard.title} — Joy World Cityfuns WMS
        </p>
      </div>

      {/* Empty State */}
      <div className="
        flex flex-col items-center justify-center
        rounded-2xl border border-dashed border-[var(--color-border-subtle)]
        bg-[var(--color-surface-elevated)]
        py-20 px-6
      ">
        {/* Icon */}
        <div className="
          w-16 h-16 rounded-2xl mb-4
          bg-[var(--color-brand-primary)]/10
          flex items-center justify-center
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] text-center max-w-[300px]">
          {t.dashboard.emptyState}
        </p>
      </div>
    </div>
  );
}
