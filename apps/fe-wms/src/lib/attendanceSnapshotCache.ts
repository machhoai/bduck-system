import type { AttendanceCheckInContext } from "@bduck/shared-types";

import {
  readClientSnapshot,
  writeClientSnapshot,
} from "@/lib/clientSnapshotCache";
import { getTodayKey } from "@/utils/attendance";

const NAMESPACE_PREFIX = "attendance-context-v1";
const ATTENDANCE_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

function namespaceForToday() {
  return `${NAMESPACE_PREFIX}:${getTodayKey()}`;
}

export async function readAttendanceSnapshot(
  userId: string,
): Promise<AttendanceCheckInContext | null> {
  const cached = await readClientSnapshot<AttendanceCheckInContext>(
    userId,
    namespaceForToday(),
  );
  return cached?.value ?? null;
}

export async function writeAttendanceSnapshot(
  userId: string,
  context: AttendanceCheckInContext,
): Promise<void> {
  await writeClientSnapshot({
    ownerId: userId,
    namespace: namespaceForToday(),
    ttlMs: ATTENDANCE_CONTEXT_TTL_MS,
    value: context,
  });
}
