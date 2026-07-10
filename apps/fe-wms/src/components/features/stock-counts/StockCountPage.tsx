"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  ListChecks,
  Plus,
  Search,
  Smartphone,
  Warehouse,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses, useWarehouseLocations } from "@/hooks/useWarehouses";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useStockCounts } from "@/hooks/useStockCounts";
import { useUserStore } from "@/stores/useUserStore";
import { StockCountCreateSheet } from "./StockCountCreateSheet";
import { StockCountWorkPanel } from "./StockCountWorkPanel";
import type {
  CreateStockCountPayload,
  StockCountSessionRow,
} from "@/api/stockCountApi";

const STOCK_COUNT_CREATE_PERMISSIONS = [
  "stock_counts.create",
  "external_count.count",
];

function getScopedWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
  permissionKeys: string[],
) {
  const globalPerms = permissions.global || {};
  if (
    globalPerms["*"] === true ||
    permissionKeys.some((permission) => globalPerms[permission] === true)
  ) {
    return { isGlobal: true, ids: [] as string[] };
  }

  return {
    isGlobal: false,
    ids: Object.entries(permissions)
      .filter(([scope, scopedPermissions]) => {
        if (scope === "global") return false;
        return (
          scopedPermissions["*"] === true ||
          permissionKeys.some(
            (permission) => scopedPermissions[permission] === true,
          )
        );
      })
      .map(([scope]) => scope),
  };
}

function toTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof timestamp.toDate === "function")
      return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === "number")
      return timestamp._seconds * 1000;
  }
  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value: unknown) {
  const time = toTime(value);
  if (!time) return "-";
  return new Date(time).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StockCountPage() {
  const { t, lang } = useTranslation();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const permissions = useUserStore((state) => state.permissions);
  const canCreate = STOCK_COUNT_CREATE_PERMISSIONS.some((permission) =>
    hasPermission(permission),
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [query, setQuery] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isCreating, setCreating] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const { warehouses } = useWarehouses();
  const { locations } = useWarehouseLocations(warehouseId || undefined);
  const { products } = useProducts();
  const { categories } = useCategories();
  const {
    sessions,
    detail,
    loading,
    detailLoading,
    loadDetail,
    createSession,
    updateItem,
    submitSession,
    setDetail,
  } = useStockCounts({ warehouseId: warehouseId || undefined });

  const text = t.stockCount;

  const creatableWarehouseScope = useMemo(
    () => getScopedWarehouseIds(permissions, STOCK_COUNT_CREATE_PERMISSIONS),
    [permissions],
  );

  const creatableWarehouses = useMemo(() => {
    if (creatableWarehouseScope.isGlobal) return warehouses;
    return warehouses.filter((warehouse) =>
      creatableWarehouseScope.ids.includes(warehouse.id),
    );
  }, [creatableWarehouseScope, warehouses]);

  const defaultCreateWarehouseId = creatableWarehouses.some(
    (warehouse) => warehouse.id === warehouseId,
  )
    ? warehouseId
    : "";

  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (!q) return true;
      return [
        session.session_number,
        session.status,
        session.warehouse_name,
        session.warehouse_code,
        session.location_name,
        session.location_code,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [query, sessions]);

  const summary = useMemo(
    () => ({
      active: visibleSessions.filter(
        (session) => session.status === "IN_PROGRESS",
      ).length,
      issues: visibleSessions.filter(
        (session) => session.status === "DISCREPANCY_FOUND",
      ).length,
      verified: visibleSessions.filter(
        (session) => session.status === "VERIFIED",
      ).length,
    }),
    [visibleSessions],
  );

  const handleCreate = async (payload: CreateStockCountPayload) => {
    setCreating(true);
    const action = createSession(payload);
    gooeyToast.promise(action, {
      loading: text.creating,
      success: text.createOk,
      error: text.createError,
      description: { success: text.createOk, error: text.createError },
      action: {
        error: { label: text.retry, onClick: () => void handleCreate(payload) },
      },
    });
    try {
      await action;
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const openSession = async (session: StockCountSessionRow) => {
    await loadDetail(session.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 md:pb-3">
      <header className="rounded-[var(--radius-lg)] flex flex-col gap-3 border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-3 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
              {text.title}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {text.subtitle}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label={text.metrics.active} value={summary.active} />
          <Metric
            label={text.metrics.issue}
            value={summary.issues}
            tone="warn"
          />
          <Metric
            label={text.metrics.verified}
            value={summary.verified}
            tone="ok"
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 shrink-0 gap-3 min-h-4xl lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex full lg:h-auto flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-2 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="grid gap-2">
            <label className="grid gap-0.5">
              <select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-sm outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-all"
              >
                <option value="">{text.allWarehouses}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.search}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] pl-8 pr-2.5 text-sm outline-none focus:border-[var(--color-border-focus)] focus:bg-white transition-all"
              />
            </label>
          </div>

          <div className="flex flex-1 min-h-0 flex-col gap-3">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] border border-[var(--color-border-soft)]"
                    />
                  ))}
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center text-center text-xs text-[var(--color-text-muted)] py-4">
                  <ListChecks className="h-8 w-8 text-[var(--color-neutral-300)]" />
                  <p className="mt-1 font-semibold">{text.noSession}</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {visibleSessions.map((session) => {
                    const isActive = detail?.session.id === session.id;
                    let borderLeftStyle =
                      "border-l-[3px] border-l-[var(--color-border-subtle)]";
                    let badgeStyle =
                      "bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]";
                    if (session.status === "IN_PROGRESS") {
                      borderLeftStyle =
                        "border-l-[3px] border-l-[var(--color-warning-icon)]";
                      badgeStyle =
                        "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]";
                    } else if (session.status === "DISCREPANCY_FOUND") {
                      borderLeftStyle =
                        "border-l-[3px] border-l-[var(--color-error-icon)]";
                      badgeStyle =
                        "bg-[var(--color-error-bg)] text-[var(--color-error-text)] border-[var(--color-error-border)]";
                    } else if (session.status === "VERIFIED") {
                      borderLeftStyle =
                        "border-l-[3px] border-l-[var(--color-success-icon)]";
                      badgeStyle =
                        "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]";
                    }

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => void openSession(session)}
                        className={`relative flex flex-col p-3 text-left rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer hover:translate-y-[-1px] hover:shadow-sm ${borderLeftStyle} ${
                          isActive
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] shadow-sm"
                            : "border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                              {session.session_number}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)] font-medium">
                              {session.warehouse_name || session.warehouse_id}
                            </p>
                          </div>
                          <span
                            className={`rounded-[var(--radius-xs)] border px-1.5 py-0.5 text-xxs font-bold tracking-wider ${badgeStyle}`}
                          >
                            {text.statuses[
                              session.status as keyof typeof text.statuses
                            ] || session.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xxs text-[var(--color-text-secondary)]">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Warehouse className="h-3 w-3 text-[var(--color-text-muted)]" />
                            {text.scopes[
                              session.count_scope as keyof typeof text.scopes
                            ] ||
                              session.count_scope ||
                              "PRODUCT"}
                          </span>
                          <span className="text-[var(--color-text-muted)]">
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!canCreate}
            className="flex w-full h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] cursor-pointer shadow-sm mt-1 lg:mt-0 self-end"
          >
            <Plus className="h-8 w-8" />
            <span>{text.create}</span>
          </button>
        </aside>

        {/* Desktop View Workspace */}
        <main className="hidden lg:block lg:min-h-0">
          <StockCountWorkPanel
            lang={lang}
            detail={detail}
            loading={detailLoading}
            isSubmitting={isSubmitting}
            onSaveItem={async (itemId, payload) => {
              if (!detail) return;
              await updateItem(detail.session.id, itemId, payload);
            }}
            onSubmitSession={async () => {
              if (!detail) return;
              setSubmitting(true);
              try {
                await submitSession(detail.session.id);
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </main>
      </div>

      {/* Mobile View Workspace (rendered outside of layout flow for overlay compatibility) */}
      <div className="lg:hidden">
        <StockCountWorkPanel
          lang={lang}
          detail={detail}
          loading={detailLoading}
          isSubmitting={isSubmitting}
          onSaveItem={async (itemId, payload) => {
            if (!detail) return;
            await updateItem(detail.session.id, itemId, payload);
          }}
          onSubmitSession={async () => {
            if (!detail) return;
            setSubmitting(true);
            try {
              await submitSession(detail.session.id);
            } finally {
              setSubmitting(false);
            }
          }}
          onCloseMobile={() => setDetail(null)}
        />
      </div>

      <StockCountCreateSheet
        isOpen={isCreateOpen}
        lang={lang}
        warehouses={creatableWarehouses}
        locations={locations}
        products={products}
        categories={categories}
        defaultWarehouseId={defaultCreateWarehouseId}
        isSubmitting={isCreating}
        onWarehouseChange={setWarehouseId}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => void handleCreate(payload)}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  let cardStyle =
    "bg-[var(--color-surface-card)] border-[var(--color-border-soft)] text-[var(--color-text-primary)]";
  if (tone === "ok") {
    cardStyle =
      "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]";
  } else if (tone === "warn") {
    cardStyle =
      "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)]";
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border px-3 py-2 transition-all duration-200 hover:shadow-md ${cardStyle}`}
    >
      <p className="text-[11px] font-semibold tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
