import type {
  PosOrderPaymentStatus,
  PosOrderSyncStatus,
} from "@bduck/shared-types";
import { Search, SlidersHorizontal } from "lucide-react";

import type { PosOrderFiltersValue } from "@/utils/posOrderFilters";

import { usePosOrderCopy } from "./usePosOrderCopy";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

export function PosOrderFilters({
  value,
  employees,
  onChange,
}: {
  value: PosOrderFiltersValue;
  employees: Array<{ id: string; name: string }>;
  onChange: (value: PosOrderFiltersValue) => void;
}) {
  const copy = usePosOrderCopy();
  const set = <K extends keyof PosOrderFiltersValue>(
    key: K,
    next: PosOrderFiltersValue[K],
  ) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-slate-50/95 md:static md:bg-transparent">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={15}
          />
          <input
            value={value.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder={copy.search}
            className={`${inputClass} pl-9`}
          />
        </div>
        <SlidersHorizontal
          className="shrink-0 text-amber-600 md:hidden"
          size={18}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <input
          value={value.phone}
          onChange={(event) => set("phone", event.target.value)}
          placeholder={copy.phone}
          inputMode="tel"
          className={inputClass}
        />
        <select
          value={value.paymentStatus}
          onChange={(event) =>
            set(
              "paymentStatus",
              event.target.value as PosOrderPaymentStatus | "",
            )
          }
          className={inputClass}
          aria-label={copy.payment}
        >
          <option value="">
            {copy.payment}: {copy.all}
          </option>
          <option value="DRAFT">{copy.draft}</option>
          <option value="PAID">{copy.paid}</option>
          <option value="REFUNDING">{copy.refunding}</option>
          <option value="REFUNDED">{copy.refunded}</option>
          <option value="REFUND_FAILED">{copy.refundFailed}</option>
          <option value="REFUND_UNKNOWN">{copy.refundUnknown}</option>
        </select>
        <select
          value={value.syncStatus}
          onChange={(event) =>
            set("syncStatus", event.target.value as PosOrderSyncStatus | "")
          }
          className={inputClass}
          aria-label={copy.sync}
        >
          <option value="">
            {copy.sync}: {copy.all}
          </option>
          <option value="NOT_SYNCED">{copy.notSynced}</option>
          <option value="PENDING">{copy.pending}</option>
          <option value="SYNCING">{copy.syncing}</option>
          <option value="SYNC_FAILED">{copy.syncFailed}</option>
          <option value="SYNC_SUCCESS">{copy.syncSuccess}</option>
          <option value="CANCELLED">{copy.cancelled}</option>
        </select>
        <select
          value={value.operatorId}
          onChange={(event) => set("operatorId", event.target.value)}
          className={inputClass}
          aria-label={copy.employee}
        >
          <option value="">
            {copy.employee}: {copy.all}
          </option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <input
          value={value.product}
          onChange={(event) => set("product", event.target.value)}
          placeholder={copy.product}
          className={inputClass}
        />
        <select
          value={`${value.sortBy}:${value.sortDir}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(":") as [
              PosOrderFiltersValue["sortBy"],
              PosOrderFiltersValue["sortDir"],
            ];
            onChange({ ...value, sortBy, sortDir });
          }}
          className={inputClass}
          aria-label="Sort"
        >
          <option value="createdAt:desc">{copy.newest}</option>
          <option value="createdAt:asc">{copy.oldest}</option>
          <option value="totalAmount:desc">{copy.amountHigh}</option>
          <option value="totalAmount:asc">{copy.amountLow}</option>
        </select>
      </div>
    </div>
  );
}
