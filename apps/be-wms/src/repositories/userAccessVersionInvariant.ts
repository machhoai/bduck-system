export interface UserAccessActivationMetadataState {
  activeVersionId: string | null;
  accessVersion: number;
  sourceFingerprint: string;
}

export interface UserAccessActivationVersionState {
  id: string;
  versionNumber: number;
  sourceFingerprint: string;
  status: "ACTIVE" | "BUILDING" | "FAILED" | "RETIRED";
}

export type UserAccessVersionNumberClaim = Pick<
  UserAccessActivationVersionState,
  "id" | "status"
>;

const isValidVersionNumber = (versionNumber: number): boolean =>
  Number.isSafeInteger(versionNumber) && versionNumber > 0;

export const assertUniqueUserAccessVersionNumber = (
  stagedVersionId: string,
  stagedVersionNumber: number,
  claimsWithSameNumber: readonly UserAccessVersionNumberClaim[],
): void => {
  if (!isValidVersionNumber(stagedVersionNumber)) {
    throw new Error("USER_ACCESS_VERSION_NUMBER_INVALID");
  }

  const versionIds = new Set(
    claimsWithSameNumber
      .filter(({ status }) => status !== "FAILED")
      .map(({ id }) => id),
  );
  if (versionIds.size !== 1 || !versionIds.has(stagedVersionId)) {
    throw new Error("USER_ACCESS_VERSION_NUMBER_CONFLICT");
  }
};

export const assertUserAccessVersionActivationSequence = (
  metadata: UserAccessActivationMetadataState | null,
  stagedVersion: UserAccessActivationVersionState,
  previousVersion: UserAccessActivationVersionState | null,
): void => {
  if (!isValidVersionNumber(stagedVersion.versionNumber)) {
    throw new Error("USER_ACCESS_VERSION_NUMBER_INVALID");
  }

  if (!metadata || metadata.activeVersionId === null) {
    if (previousVersion || (metadata && metadata.accessVersion !== 0)) {
      throw new Error("USER_ACCESS_INITIAL_METADATA_MISMATCH");
    }
    if (stagedVersion.versionNumber !== 1) {
      throw new Error("USER_ACCESS_INITIAL_VERSION_MISMATCH");
    }
    return;
  }

  if (
    !previousVersion ||
    previousVersion.status !== "ACTIVE" ||
    previousVersion.id !== metadata.activeVersionId ||
    metadata.accessVersion !== previousVersion.versionNumber ||
    metadata.sourceFingerprint !== previousVersion.sourceFingerprint
  ) {
    throw new Error("USER_ACCESS_PREVIOUS_VERSION_MISMATCH");
  }

  const nextVersionNumber = previousVersion.versionNumber + 1;
  if (
    !isValidVersionNumber(previousVersion.versionNumber) ||
    !isValidVersionNumber(nextVersionNumber) ||
    stagedVersion.versionNumber !== nextVersionNumber
  ) {
    throw new Error("USER_ACCESS_VERSION_SEQUENCE_MISMATCH");
  }
};
