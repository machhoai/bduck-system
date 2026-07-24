import {
  LeaveRequestStatus,
  LeaveRequestType,
} from "@bduck/shared-types";

export function LeaveRequestFilters({
  labels,
  status,
  type,
  statusLabels,
  typeLabels,
  onStatusChange,
  onTypeChange,
}: {
  labels: Record<string, string>;
  status: string;
  type: string;
  statusLabels: Record<LeaveRequestStatus, string>;
  typeLabels: Record<LeaveRequestType, string>;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 pb-1">
      <select
        value={status}
        aria-label={labels.filterLeaveStatus}
        onChange={(event) => onStatusChange(event.target.value)}
        className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-2 text-xs"
      >
        <option value="ALL">{labels.allStatuses}</option>
        {Object.values(LeaveRequestStatus).map((value) => (
          <option key={value} value={value}>
            {labels[statusLabels[value]]}
          </option>
        ))}
      </select>
      <select
        value={type}
        aria-label={labels.filterLeaveType}
        onChange={(event) => onTypeChange(event.target.value)}
        className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-2 text-xs"
      >
        <option value="ALL">{labels.allLeaveTypes}</option>
        {Object.values(LeaveRequestType).map((value) => (
          <option key={value} value={value}>
            {labels[typeLabels[value]]}
          </option>
        ))}
      </select>
    </div>
  );
}
