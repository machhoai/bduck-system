"use client";

import { useTranslation } from "@/lib/i18n";
import { Workflow, Plus, Search } from "lucide-react";
import Link from "next/link";

/**
 * Workflow List Page — lists all workflow definitions.
 *
 * Phase 1: Static placeholder UI with a "create" button.
 * Phase 2: Firestore listener for real-time workflow_definitions.
 */
export default function WorkflowListPage() {
  const { t } = useTranslation();

  // Mock — will be replaced by useWorkflowDefinitions() hook
  const workflows: unknown[] = [];

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)]">
            {t.workflows.title}
          </h1>
          <p className="mt-1 text-[17px] text-[var(--color-text-muted)]">
            {t.workflows.subtitle}
          </p>
        </div>
        <Link
          href="/workflows/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-5 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.workflows.addNew}
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          placeholder={t.workflows.search}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-brand-primary)]"
        />
      </div>

      {/* Content */}
      {workflows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <Workflow
            size={48}
            className="mb-4 text-[var(--color-text-muted)] opacity-50"
          />
          <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
            {t.workflows.empty}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.workflows.emptyHint}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Workflow cards will be rendered here */}
        </div>
      )}
    </div>
  );
}
