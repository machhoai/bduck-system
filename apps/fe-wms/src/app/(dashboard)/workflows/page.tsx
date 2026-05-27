"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Workflow,
  Plus,
  Search,
  Settings2,
  Clock,
  Zap,
  Archive,
  MoreVertical,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import type { WorkflowDefinitionView } from "@/hooks/useWorkflowDefinitions";
import {
  WorkflowDefinitionStatus,
  ApprovalEntityType,
} from "@bduck/shared-types";
import { archiveWorkflowDefinition } from "@/hooks/useWorkflowApi";
import { gooeyToast } from "goey-toast";

/**
 * Workflow List Page — lists all workflow definitions from Firestore.
 *
 * Features:
 * - Realtime via onSnapshot
 * - Filter by status + entity_type
 * - Search by name/description
 * - Archive (soft delete) via context menu
 * - Skeleton loading
 */

// ── Constants ──

const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  [WorkflowDefinitionStatus.DRAFT]: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
    label: "Nháp",
  },
  [WorkflowDefinitionStatus.ACTIVE]: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Hoạt động",
  },
  [WorkflowDefinitionStatus.ARCHIVED]: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Lưu trữ",
  },
};

const ENTITY_LABELS: Record<string, string> = {
  [ApprovalEntityType.IMPORT_VOUCHER]: "Phiếu nhập kho",
  [ApprovalEntityType.EXPORT_VOUCHER]: "Phiếu xuất kho",
  [ApprovalEntityType.TRANSFER_ORDER]: "Lệnh chuyển kho",
  [ApprovalEntityType.PURCHASE_ORDER]: "Đơn mua hàng",
  [ApprovalEntityType.ADJUSTMENT_VOUCHER]: "Phiếu điều chỉnh",
  [ApprovalEntityType.GIFT_SESSION]: "Phiên phát quà",
};

type StatusFilter = "ALL" | WorkflowDefinitionStatus;
type EntityFilter = "ALL" | ApprovalEntityType;

// ── Sub-Components ──

function WorkflowCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-lg bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-20 rounded-full bg-gray-100" />
        <div className="h-5 w-16 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 h-3 w-2/3 rounded bg-gray-50" />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all
        ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`min-w-[18px] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none
            ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function WorkflowCard({
  definition,
  onArchive,
}: {
  definition: WorkflowDefinitionView;
  onArchive: (id: string, name: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const badge = STATUS_BADGE[definition.status] || STATUS_BADGE.DRAFT;
  const entityLabel =
    ENTITY_LABELS[definition.entity_type] || definition.entity_type;

  const formatDate = (date: Date) =>
    date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/30">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/workflows/${definition.id}`}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100"
        >
          <Workflow className="h-4.5 w-4.5" />
        </Link>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>

          {/* Context menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
                  <Link
                    href={`/workflows/${definition.id}`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Chỉnh sửa
                  </Link>
                  {definition.status !== WorkflowDefinitionStatus.ARCHIVED && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onArchive(definition.id, definition.name);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Lưu trữ (vô hiệu hóa)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name + description */}
      <Link href={`/workflows/${definition.id}`} className="mt-3 block">
        <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-1 transition-colors group-hover:text-blue-700">
          {definition.name}
        </h3>
      </Link>
      {definition.description && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {definition.description}
        </p>
      )}

      {/* Meta tags */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
          <Zap className="h-3 w-3" />
          {entityLabel}
        </span>
        {definition.current_version_id && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            <Settings2 className="h-3 w-3" />
            Đã xuất bản
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-gray-50 pt-3 text-[11px] text-gray-400">
        <Clock className="h-3 w-3" />
        <span>Tạo: {formatDate(definition.created_at)}</span>
        <span className="mx-1">·</span>
        <span>Cập nhật: {formatDate(definition.updated_at)}</span>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function WorkflowListPage() {
  const { t } = useTranslation();
  const { definitions, loading, error } = useWorkflowDefinitions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("ALL");

  // Count per status for filter chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: definitions.length,
      [WorkflowDefinitionStatus.DRAFT]: 0,
      [WorkflowDefinitionStatus.ACTIVE]: 0,
      [WorkflowDefinitionStatus.ARCHIVED]: 0,
    };
    for (const d of definitions) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [definitions]);

  // Unique entity types present in data
  const entityTypes = useMemo(() => {
    const types = new Set(definitions.map((d) => d.entity_type));
    return Array.from(types);
  }, [definitions]);

  const filteredDefinitions = useMemo(() => {
    let result = definitions;

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Entity type filter
    if (entityFilter !== "ALL") {
      result = result.filter((d) => d.entity_type === entityFilter);
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.entity_type.toLowerCase().includes(q),
      );
    }

    return result;
  }, [definitions, statusFilter, entityFilter, searchQuery]);

  const handleArchive = useCallback((id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn lưu trữ (vô hiệu hóa) quy trình "${name}"?`)) return;

    gooeyToast.promise(archiveWorkflowDefinition(id), {
      loading: "Đang lưu trữ quy trình...",
      success: "Đã lưu trữ quy trình",
      error: "Lỗi lưu trữ quy trình",
      description: {
        success: `Quy trình "${name}" đã được vô hiệu hóa.`,
        error: "Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
      },
      action: {
        error: {
          label: "Thử lại",
          onClick: () => handleArchive(id, name),
        },
      },
    });
  }, []);

  const hasActiveFilters = statusFilter !== "ALL" || entityFilter !== "ALL";

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-5">
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

      {/* Search + Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.workflows.search}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-brand-primary)]"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
            <Filter className="h-3.5 w-3.5" />
            Trạng thái:
          </div>
          <FilterChip
            label="Tất cả"
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
            count={statusCounts.ALL}
          />
          <FilterChip
            label="Hoạt động"
            active={statusFilter === WorkflowDefinitionStatus.ACTIVE}
            onClick={() =>
              setStatusFilter(
                statusFilter === WorkflowDefinitionStatus.ACTIVE
                  ? "ALL"
                  : WorkflowDefinitionStatus.ACTIVE,
              )
            }
            count={statusCounts[WorkflowDefinitionStatus.ACTIVE]}
          />
          <FilterChip
            label="Nháp"
            active={statusFilter === WorkflowDefinitionStatus.DRAFT}
            onClick={() =>
              setStatusFilter(
                statusFilter === WorkflowDefinitionStatus.DRAFT
                  ? "ALL"
                  : WorkflowDefinitionStatus.DRAFT,
              )
            }
            count={statusCounts[WorkflowDefinitionStatus.DRAFT]}
          />
          <FilterChip
            label="Lưu trữ"
            active={statusFilter === WorkflowDefinitionStatus.ARCHIVED}
            onClick={() =>
              setStatusFilter(
                statusFilter === WorkflowDefinitionStatus.ARCHIVED
                  ? "ALL"
                  : WorkflowDefinitionStatus.ARCHIVED,
              )
            }
            count={statusCounts[WorkflowDefinitionStatus.ARCHIVED]}
          />

          {entityTypes.length > 1 && (
            <>
              <div className="mx-1 h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                Loại:
              </div>
              <FilterChip
                label="Tất cả"
                active={entityFilter === "ALL"}
                onClick={() => setEntityFilter("ALL")}
              />
              {entityTypes.map((type) => (
                <FilterChip
                  key={type}
                  label={ENTITY_LABELS[type] || type}
                  active={entityFilter === type}
                  onClick={() =>
                    setEntityFilter(
                      entityFilter === type ? "ALL" : (type as EntityFilter),
                    )
                  }
                />
              ))}
            </>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setEntityFilter("ALL");
              }}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-red-200 bg-red-50 px-4 py-12 text-center">
          <Workflow size={48} className="mb-4 text-red-400 opacity-70" />
          <h3 className="text-[17px] font-semibold text-red-700">
            Không thể tải danh sách quy trình
          </h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      ) : filteredDefinitions.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <Workflow
            size={48}
            className="mb-4 text-[var(--color-text-muted)] opacity-50"
          />
          <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
            {searchQuery || hasActiveFilters
              ? "Không tìm thấy kết quả"
              : t.workflows.empty}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {searchQuery || hasActiveFilters
              ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
              : t.workflows.emptyHint}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Hiển thị {filteredDefinitions.length} / {definitions.length} quy trình
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDefinitions.map((def) => (
              <WorkflowCard
                key={def.id}
                definition={def}
                onArchive={handleArchive}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
