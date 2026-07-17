# Facility access backfill

This migration prepares existing users and role assignments for office-managed facility scopes. It does not infer office-to-facility edges from legacy user assignments.

## Safety contract

- Dry-run is the default and performs Firestore reads only.
- Apply mode requires `--confirm-project` to exactly match the configured Firebase project.
- Existing `warehouse_id: null` assignments keep their legacy global meaning and are reported for manual review.
- Existing assignments are marked `LEGACY_DIRECT`; they never become inherited office grants automatically.
- A workplace is copied only when one non-deleted `ACTIVE` employee profile
  references an existing, non-deleted, `ACTIVE` facility.
- The profile set and active workplace facility are re-read in the same
  transaction as the user mutation. Only a typed source conflict may be
  reported and skipped; transient Firestore failures stop the run for resume.
- Conflicts, missing facilities, duplicate profiles, orphan users/profiles, and deleted records are reported without guessing.
- Every domain write, its audit log, lease validation, document cursor, and
  progress counters are committed in the same transaction.
- Expired or displaced workers cannot write items, advance stages, or mark a
  run complete. Resume starts after the last atomically committed cursor. No
  document is hard-deleted.

## Commands

Read-only planning run:

```powershell
pnpm migrate:facility-access
```

Apply to an explicitly confirmed project:

```powershell
pnpm migrate:facility-access -- --apply --confirm-project=<firebase-project-id> --initiated-by=<admin-user-id>
```

Resume an interrupted apply run:

```powershell
pnpm migrate:facility-access -- --apply --resume --confirm-project=<firebase-project-id> --initiated-by=<admin-user-id>
```

Optional controls:

- `--batch-size=<1..100>`; default `25`.
- `--migration-id=<id>`; default `facility-access-v1`.

The command prints a JSON report with planned/written domain and audit writes plus issue counts and up to 100 issue samples. Apply progress is stored in `facility_access_migrations/{migration-id}`.

## Expected writes

- `users.workplace_facility_id`
- `user_warehouse_roles.scope_origin = LEGACY_DIRECT`
- Empty `SELECTED` records in `office_scope_configs` for offices without a configuration
- Matching immutable records in `audit_logs`

The migration intentionally creates no `office_scope_edges` and no materialized `user_access` grant versions. Those are configured and built in later rollout phases.

## Materialized access rebuild

After the phase 1 backfill and office scope configuration, inspect durable
pending/failed rebuild requests without writing:

```powershell
pnpm rebuild:user-access
```

Repair pending/failed requests:

```powershell
pnpm rebuild:user-access -- --apply --confirm-project=<firebase-project-id> --initiated-by=<admin-user-id>
```

Rebuild one user or every active user:

```powershell
pnpm rebuild:user-access -- --apply --user-id=<user-id> --confirm-project=<firebase-project-id> --initiated-by=<admin-user-id>
pnpm rebuild:user-access -- --apply --all --confirm-project=<firebase-project-id> --initiated-by=<admin-user-id>
```

Use `--limit=<1..1000>` to bound a repair batch. The command is idempotent:
an already current snapshot is left unchanged; interrupted matching `BUILDING`
snapshots are reused; source drift prevents activation and leaves a durable
request for retry. No version, grant, request, or lock document is hard-deleted.

## Phase 7 rollout mode

Use shadow serving while validating a deployed dataset:

```dotenv
FACILITY_AUTHORIZATION_MODE=SHADOW
```

The backend continues serving the live role-built decision and records only
aggregated mismatch summaries in `authorization_shadow_diffs`. Each stable
combination of actor, outcome, differing fields, and fingerprints increments
`observation_count`, preserving first/last observation timestamps without hard
deletes.

After every mismatch group is understood and affected users have a valid
active snapshot, cut over with:

```dotenv
FACILITY_AUTHORIZATION_MODE=MATERIALIZED
```

Materialized mode is the repository default and fails closed. A missing or
invalid active snapshot must be repaired with `pnpm rebuild:user-access`; it is
never replaced with a global or role-derived fallback during the request.
