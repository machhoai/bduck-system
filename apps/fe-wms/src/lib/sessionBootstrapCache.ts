import type { User, UserWarehouseRole } from "@bduck/shared-types";

import {
  readClientSnapshot,
  writeClientSnapshot,
} from "@/lib/clientSnapshotCache";

export type CachedPermissionMap = Record<string, Record<string, unknown>>;

export interface SessionBootstrapSnapshot {
  user: User;
  roleIds: string[];
  roleAssignments: UserWarehouseRole[];
  permissions: CachedPermissionMap;
  accessVersion: number;
  activeAccessVersionId: string;
}

const NAMESPACE = "session-bootstrap-v1";
const SESSION_BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSessionBootstrapSnapshot(
  value: unknown,
  expectedUserId: string,
): value is SessionBootstrapSnapshot {
  if (!isRecord(value) || !isRecord(value.user)) return false;
  return (
    value.user.id === expectedUserId &&
    Array.isArray(value.roleIds) &&
    value.roleIds.every((roleId) => typeof roleId === "string") &&
    Array.isArray(value.roleAssignments) &&
    isRecord(value.permissions) &&
    typeof value.accessVersion === "number" &&
    Number.isSafeInteger(value.accessVersion) &&
    typeof value.activeAccessVersionId === "string" &&
    value.activeAccessVersionId.length > 0
  );
}

export async function readSessionBootstrap(
  userId: string,
): Promise<SessionBootstrapSnapshot | null> {
  const cached = await readClientSnapshot<unknown>(userId, NAMESPACE);
  return cached && isSessionBootstrapSnapshot(cached.value, userId)
    ? cached.value
    : null;
}

export async function writeSessionBootstrap(
  snapshot: SessionBootstrapSnapshot,
): Promise<void> {
  const { password_hash: _passwordHash, ...userWithoutPasswordHash } = {
    ...snapshot.user,
  } as User & {
    password_hash?: string;
  };
  const safeUser = userWithoutPasswordHash as User;

  await writeClientSnapshot({
    ownerId: snapshot.user.id,
    namespace: NAMESPACE,
    ttlMs: SESSION_BOOTSTRAP_TTL_MS,
    value: { ...snapshot, user: safeUser },
  });
}
