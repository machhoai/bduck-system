import {
    AttendanceWorkArrangementStatus,
    AttendanceWorkArrangementType,
    type AttendanceWorkArrangement,
} from "@bduck/shared-types";
import { BriefcaseBusiness, House, Trash2 } from "lucide-react";

export function AttendanceWorkArrangementList({
    labels,
    arrangements,
    cancellingId,
    onCancel,
}: {
    labels: Record<string, string>;
    arrangements: AttendanceWorkArrangement[];
    cancellingId: string | null;
    onCancel: (arrangementId: string) => Promise<void>;
}) {
    return (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
            {arrangements.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border-soft)] p-3"
                >
                    {item.type === AttendanceWorkArrangementType.BUSINESS_TRIP ? (
                        <BriefcaseBusiness size={17} className="text-[#0066cc]" />
                    ) : (
                        <House size={17} className="text-[#257a3e]" />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                            {item.employee_name}
                        </p>
                        <p className="truncate text-micro text-[var(--color-text-muted)]">
                            {item.start_date} → {item.end_date} · {item.reason}
                        </p>
                    </div>
                    {item.status === AttendanceWorkArrangementStatus.APPROVED ? (
                        <button
                            type="button"
                            title={labels.cancelWorkArrangement}
                            onClick={() => void onCancel(item.id)}
                            disabled={Boolean(cancellingId)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#b42318] hover:bg-[#b4231810] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 size={14} />
                        </button>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
