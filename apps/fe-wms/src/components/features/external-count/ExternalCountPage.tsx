"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye, MapPin, Plus, Search, ShieldCheck } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { externalCountApi, type ExternalCountSession } from "@/api/externalCountApi";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import ExternalCountDrawer from "./ExternalCountDrawer";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function statusClass(status: string) {
  if (["VERIFIED", "RESOLVED", "COMPLETED"].includes(status)) {
    return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  }
  if (status === "CANCELLED") {
    return "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]";
  }
  if (status === "DISCREPANCY_FOUND") {
    return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  }
  return "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]";
}

export default function ExternalCountPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canCount = hasPermission("external_count.count");
  const { warehouses } = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const { locations } = useWarehouseLocations(warehouseId || undefined);
  const [locationId, setLocationId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayString());
  const [purpose, setPurpose] = useState<"EXTERNAL_OPENING" | "EXTERNAL_CLOSING">("EXTERNAL_CLOSING");
  const [blindCount, setBlindCount] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sessions, setSessions] = useState<ExternalCountSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await externalCountApi.list({
        warehouse_id: warehouseId || undefined,
        warehouse_location_id: locationId || undefined,
        business_date: businessDate || undefined,
      });
      setSessions(response.data || []);
    } catch (error) {
      console.error("[ExternalCountPage] fetch failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [businessDate, locationId, warehouseId]);

  useEffect(() => {
    void fetchSessions();
    const timer = window.setInterval(fetchSessions, 5000);
    return () => window.clearInterval(timer);
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) =>
      [
        session.session_number,
        session.location_name,
        session.location_code,
        session.warehouse_name,
        session.warehouse_code,
        session.counter_name,
        session.external_operator_name,
        session.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [searchTerm, sessions]);

  const createSession = async () => {
    if (!warehouseId || !locationId) {
      gooeyToast.error("Thiếu quầy kiểm đếm", {
        description: "Vui lòng chọn kho và quầy trước khi tạo phiên.",
      });
      return;
    }
    setIsCreating(true);
    const action = externalCountApi.create({
      warehouse_id: warehouseId,
      warehouse_location_id: locationId,
      count_purpose: purpose,
      business_date: businessDate,
      blind_count_enabled: blindCount,
      external_operator_name: operatorName || null,
      notes: null,
    });
    gooeyToast.promise(action, {
      loading: "Đang tạo phiên kiểm đếm...",
      success: "Đã tạo phiên kiểm đếm",
      error: "Không thể tạo phiên",
      description: {
        success: "Danh sách barcode đã được snapshot theo ATP hiện tại.",
        error: "Có thể quầy chưa có ATP hoặc đang có phiên mở.",
      },
      action: { error: { label: "Thử lại", onClick: createSession } },
    });
    try {
      const response = await action;
      await fetchSessions();
      setSelectedSessionId(response.data.session.id);
    } catch (error) {
      console.error("[ExternalCountPage] create failed", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-112px)] flex-col gap-3 bg-[var(--color-surface-subtle)] p-3 sm:bg-transparent sm:p-0">
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Kho</span>
            <select
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setLocationId("");
              }}
              className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">Chọn kho</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name || warehouse.code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Quầy</span>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">Chọn quầy</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name || location.code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Ngày</span>
            <input
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Loại</span>
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as "EXTERNAL_OPENING" | "EXTERNAL_CLOSING")}
              className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="EXTERNAL_OPENING">Đầu ca</option>
              <option value="EXTERNAL_CLOSING">Cuối ca</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={blindCount}
              onChange={(event) => setBlindCount(event.target.checked)}
            />
            Blind count
          </label>
          <input
            value={operatorName}
            onChange={(event) => setOperatorName(event.target.value)}
            placeholder="Tên nhân viên"
            className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
          />
          {canCount && (
            <button
              type="button"
              onClick={createSession}
              disabled={isCreating}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Tạo phiên
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
        <div className="border-b border-[var(--color-border-subtle)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm phiên, quầy, kho hoặc nhân viên..."
              className="h-10 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[var(--color-neutral-50)] p-3">
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-white text-center">
              <ClipboardList className="h-10 w-10 text-[var(--color-neutral-300)]" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Chưa có phiên kiểm đếm</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Tạo phiên theo quầy để kiểm ATP cuối ca trước khi auto-submit.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(session.status)}`}>
                          {session.status}
                        </span>
                        <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                          {session.location_name || session.location_code}
                        </span>
                        <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                          {session.count_purpose === "EXTERNAL_CLOSING" ? "Cuối ca" : "Đầu ca"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                          <span className="truncate">{session.warehouse_name || session.warehouse_code}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                          <span className="truncate">{session.blind_count_enabled ? "Blind count" : "Hiện ATP"}</span>
                        </span>
                        <span className="truncate text-[var(--color-text-muted)]">
                          {session.session_number}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white"
                    >
                      <Eye className="h-4 w-4" />
                      Mở
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSessionId && (
        <ExternalCountDrawer
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          onChanged={fetchSessions}
        />
      )}
    </div>
  );
}

