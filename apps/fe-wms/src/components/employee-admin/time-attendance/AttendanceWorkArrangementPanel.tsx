"use client";

import {
    AttendanceLocationRule,
    AttendanceWorkArrangementType,
    type AttendanceWorkArrangement,
    type EmployeeProfile,
} from "@bduck/shared-types";
import { CalendarPlus } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useMemo, useState } from "react";
import { AttendanceWorkArrangementList } from "./AttendanceWorkArrangementList";

type ArrangementPayload = Omit<
    AttendanceWorkArrangement,
    | "id"
    | "warehouse_id"
    | "employee_profile_id"
    | "employee_id"
    | "employee_name"
    | "status"
    | "requested_by"
    | "approved_by"
    | "approved_at"
    | "cancelled_by"
    | "cancelled_at"
    | "created_at"
    | "updated_at"
    | "is_deleted"
>;

interface AttendanceWorkArrangementPanelProps {
    labels: Record<string, string>;
    warehouseId: string | null;
    currentUserId?: string;
    profiles: EmployeeProfile[];
    arrangements: AttendanceWorkArrangement[];
    onApprove: (payload: ArrangementPayload) => Promise<unknown>;
    onCancel: (arrangementId: string) => Promise<unknown>;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export function AttendanceWorkArrangementPanel({
    labels,
    warehouseId,
    currentUserId,
    profiles,
    arrangements,
    onApprove,
    onCancel,
}: AttendanceWorkArrangementPanelProps) {
    const employees = useMemo(
        () =>
            profiles.filter(
                (profile) =>
                    profile.workplace_warehouse_id === warehouseId &&
                    profile.user_id &&
                    profile.user_id !== currentUserId,
            ),
        [currentUserId, profiles, warehouseId],
    );
    const [userId, setUserId] = useState("");
    const [type, setType] = useState(
        AttendanceWorkArrangementType.WORK_FROM_HOME,
    );
    const [startDate, setStartDate] = useState(todayKey);
    const [endDate, setEndDate] = useState(todayKey);
    const [reason, setReason] = useState("");
    const [destinationName, setDestinationName] = useState("");
    const [useDestinationGeofence, setUseDestinationGeofence] = useState(false);
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [radiusM, setRadiusM] = useState(150);
    const [saving, setSaving] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    if (!warehouseId) return null;

    const handleApprove = async () => {
        if (saving) return;
        if (!userId || reason.trim().length < 4) {
            gooeyToast.error(labels.workArrangementValidation);
            return;
        }
        const locationRule = useDestinationGeofence
            ? AttendanceLocationRule.GEOFENCE
            : AttendanceLocationRule.CAPTURE_ONLY;
        const destinationCoordinate = useDestinationGeofence
            ? { latitude: Number(latitude), longitude: Number(longitude) }
            : null;
        if (
            useDestinationGeofence &&
            (!Number.isFinite(destinationCoordinate?.latitude) ||
                !Number.isFinite(destinationCoordinate?.longitude))
        ) {
            gooeyToast.error(labels.coordinateInvalid);
            return;
        }
        setSaving(true);
        try {
            const task = onApprove({
                user_id: userId,
                type,
                start_date: startDate,
                end_date: endDate,
                location_rule: locationRule,
                destination_name: destinationName.trim() || null,
                destination_coordinate: destinationCoordinate,
                radius_m: useDestinationGeofence ? radiusM : null,
                reason: reason.trim(),
            });
            await gooeyToast.promise(task, {
                loading: labels.savingWorkArrangement,
                success: labels.savedWorkArrangement,
                error: labels.saveWorkArrangementError,
                description: {
                    success: labels.savedWorkArrangementDesc,
                    error: labels.saveWorkArrangementErrorDesc,
                },
                action: {
                    error: {
                        label: labels.retry,
                        onClick: () => void handleApprove(),
                    },
                },
            });
            setReason("");
        } catch (error) {
            console.error("[AttendanceWorkArrangementPanel] save error:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (arrangementId: string) => {
        if (cancellingId) return;
        setCancellingId(arrangementId);
        try {
            await gooeyToast.promise(onCancel(arrangementId), {
                loading: labels.cancellingWorkArrangement,
                success: labels.cancelledWorkArrangement,
                error: labels.cancelWorkArrangementError,
                description: {
                    success: labels.cancelledWorkArrangementDesc,
                    error: labels.saveWorkArrangementErrorDesc,
                },
                action: {
                    error: {
                        label: labels.retry,
                        onClick: () => void handleCancel(arrangementId),
                    },
                },
            });
        } catch (error) {
            console.error("[AttendanceWorkArrangementPanel] cancel error:", error);
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0066cc10] text-[#0066cc]">
                    <CalendarPlus size={18} />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {labels.workArrangementTitle}
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        {labels.workArrangementHint}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
                <label className="grid gap-1 text-xs font-semibold">
                    {labels.employee}
                    <select
                        value={userId}
                        onChange={(event) => setUserId(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 font-normal"
                    >
                        <option value="">{labels.selectEmployee}</option>
                        {employees.map((profile) => (
                            <option key={profile.id} value={profile.user_id || ""}>
                                {profile.employee_code} - {profile.full_name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                    {labels.workMode}
                    <select
                        value={type}
                        onChange={(event) =>
                            setType(event.target.value as AttendanceWorkArrangementType)
                        }
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 font-normal"
                    >
                        <option value={AttendanceWorkArrangementType.WORK_FROM_HOME}>
                            {labels.workFromHome}
                        </option>
                        <option value={AttendanceWorkArrangementType.BUSINESS_TRIP}>
                            {labels.businessTrip}
                        </option>
                    </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                    {labels.fromDate}
                    <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 font-normal"
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                    {labels.toDate}
                    <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 font-normal"
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold lg:col-span-3">
                    {labels.reason}
                    <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={labels.workReasonPlaceholder}
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 font-normal"
                    />
                </label>
                <label className="flex items-center gap-2 self-end pb-3 text-xs">
                    <input
                        type="checkbox"
                        checked={useDestinationGeofence}
                        onChange={(event) =>
                            setUseDestinationGeofence(event.target.checked)
                        }
                        className="h-4 w-4 accent-[var(--color-brand-primary)]"
                    />
                    {labels.destinationGeofence}
                </label>
            </div>

            {useDestinationGeofence ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <input
                        value={destinationName}
                        onChange={(event) => setDestinationName(event.target.value)}
                        placeholder={labels.destinationName}
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 text-xs"
                    />
                    <input
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                        placeholder={labels.latitude}
                        inputMode="decimal"
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 text-xs"
                    />
                    <input
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                        placeholder={labels.longitude}
                        inputMode="decimal"
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 text-xs"
                    />
                    <input
                        type="number"
                        min={20}
                        max={5000}
                        value={radiusM}
                        onChange={(event) => setRadiusM(Number(event.target.value))}
                        aria-label="Bán kính điểm đến"
                        className="h-10 rounded-xl border border-[var(--color-border-subtle)] px-3 text-xs"
                    />
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={saving}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
                <CalendarPlus size={15} />
                {labels.saveWorkArrangement}
            </button>

            <AttendanceWorkArrangementList
                labels={labels}
                arrangements={arrangements}
                cancellingId={cancellingId}
                onCancel={handleCancel}
            />
        </section>
    );
}
