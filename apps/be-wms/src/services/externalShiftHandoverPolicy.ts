import { ExternalCountCheckpointType } from "@bduck/shared-types";

export const isOpeningExternalCheckpoint = (
  type: ExternalCountCheckpointType,
) =>
  type === ExternalCountCheckpointType.SHIFT_OPENING ||
  type === ExternalCountCheckpointType.BEFORE_SCAN;

export const calculateExternalCountExpectation = (
  baseAtp: number | null,
  currentAtp: number,
) => {
  const movementDelta = baseAtp == null ? 0 : currentAtp - baseAtp;
  return {
    movementDelta,
    expectedAtCountTime: baseAtp == null ? currentAtp : baseAtp + movementDelta,
  };
};

export const isStaleExternalHandover = (
  activeCountStartedAt: Date | null,
  candidateCountStartedAt: Date,
) =>
  Boolean(
    activeCountStartedAt &&
    activeCountStartedAt.getTime() > candidateCountStartedAt.getTime(),
  );

export const isSameExternalShift = (
  activeShiftId: string | null | undefined,
  activeShiftDate: string | null | undefined,
  candidateShiftId: string | null,
  candidateShiftDate: string,
) =>
  Boolean(
    activeShiftId &&
    activeShiftId === candidateShiftId &&
    activeShiftDate === candidateShiftDate,
  );

export const shouldFinalizeQueuedScan = (
  scanAccessSessionId: string | null | undefined,
  previousAccessSessionId: string | null,
  newAccessSessionId: string,
) =>
  scanAccessSessionId !== newAccessSessionId &&
  (!scanAccessSessionId ||
    !previousAccessSessionId ||
    scanAccessSessionId === previousAccessSessionId);
