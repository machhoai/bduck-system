# Facility access scope rollout

## Business policy locked for implementation

- A facility is one of `OFFICE`, `MAIN` (warehouse), or `STORE`.
- A warehouse or store employee has access to their own workplace by default.
- An office employee inherits the warehouse/store scope configured for their workplace office.
- `ALL` is dynamic and includes warehouses/stores created in the future. It is not a global administrator grant.
- Offices do not manage other offices. Only system administrators can manage all offices.
- Office scope inheritance is not transitive.
- New offices start with an explicit empty `SELECTED` scope; no warehouse or
  store is inherited until a system administrator configures it.
- Office managers may read their own office scope with `office_scopes.read` and
  mutate it with `office_scopes.write`, but only inside the stable ceiling
  configured by a system administrator. Direct grants never expand that
  ceiling. Only system administrators can configure or expand a ceiling.
- Access to business records follows the current effective scope; being the creator does not preserve access after revocation.
- A manager cannot grant roles, actions, or facilities beyond their own effective access.
- All removals use soft-delete and every scope mutation writes an audit log with `action_time` and `sync_time`.

## Authorization invariant

An operation is allowed only when all conditions are true:

1. The user is authenticated and active.
2. An active role grants the requested action.
3. The resource facility is inside the user's effective scope for that action.
4. Operation-specific constraints are satisfied (for example transfer source/destination policy and self-approval blocking).

Frontend visibility is never an authorization boundary. Backend authorization and Firestore Rules must both enforce this invariant.

## Office scope administration follow-up

- [x] Stage 1: reserve scope mutation for system administrators and initialize
      every new office with an audited, empty `SELECTED` configuration.
- [x] Stage 2: expose a permission-aware Office scope overview inside
      `/warehouses`. The list endpoint queries only facilities granted
      `office_scopes.read`; the UI shows configuration status, effective facility
      count, affected employees, and reacts to scoped Firestore listeners.
- [x] Stage 3: make scope edits concurrency-safe with `expected_revision`,
      preserve dirty drafts across realtime updates, add facility search/bulk
      selection, and require an impact review before applying additions or
      revocations.
- [x] Stage 4: add a dedicated, permission-scoped Office scope history with
      revision, actor, action/sync timestamps, selected-facility differences, and
      the number of employees whose access rebuild was requested.
- [x] Stage 5: attach a dedicated materialization state to every scope revision,
      expose before/after and facility differences in the timeline, and allow
      idempotent retry of only the failed users.
- [x] Stage 6: separate `office_scopes.read`, `office_scopes.write`, and the
      system-admin-only ceiling policy. Delegated managers can mutate only their
      own Office and only within its configured ceiling.
- [x] Stage 7: extend the policy matrix and emulator tests for ceiling,
      concurrency, future facilities, revocation, workplace/role changes,
      empty Offices, and partial materialization failures.

Stages 5-7 acceptance evidence:

- Each scope revision creates a public, user-ID-free materialization summary in
  the same transaction as the scope/audit write. The private failed-user job is
  backend-only. Status is `PENDING`, `COMPLETED`, or `FAILED`; an Office with no
  employees completes immediately.
- Retry first claims a failed operation, rebuilds only its failed users, and
  merges progress by user ID. Repeating a successful retry is safe and never
  creates another scope revision.
- `PUT /api/office-scopes/:officeId` requires `office_scopes.write` at that
  Office. The service additionally requires the actor's canonical workplace to
  be that Office and validates the requested facilities against the separate
  ceiling. A direct assignment outside the ceiling is deliberately ignored for
  this decision.
- `PUT /api/office-scopes/:officeId/ceiling` is system-admin-only, validates
  optimistic `expected_revision`, records old/new audit values, and supports a
  dynamic `ALL` ceiling or an explicit `SELECTED` ceiling.
- The Office detail UI shows ceiling, effective scope, dedicated history,
  affected employees, materialization counts/status, and a retry action for
  failed revisions. All mutations use disabled pending controls and promise
  toasts; labels exist in Vietnamese and Chinese.
- The 54-case access matrix explicitly covers every Stage 7 scenario. Shared,
  backend, and frontend typechecks pass; security-foundation, access-session,
  security-audit enforcement, and Firestore Rules emulator suites pass.

Stage 4 acceptance evidence:

- `GET /api/office-scopes/:officeId/history` requires
  `office_scopes.read` at the requested Office in both route middleware and
  service policy. Office A cannot use this endpoint to read Office B history.
- The endpoint returns a sanitized `OfficeScopeHistoryEntry`; arbitrary
  `old_value`/`new_value` audit payloads never cross the API boundary.
- Scope audit writes remain in the same Firestore transaction as the revision
  and edges, and now capture the actual number of Office users queued for
  access rebuilding. Existing history without this field remains readable as
  `not recorded`.
- The Office detail timeline reacts to the already grant-compatible
  `office_scope_configs/{officeId}` listener and refetches through the scoped
  API. It does not broaden direct Firestore access to `audit_logs`.
- The generic facility audit card was removed from Office detail, preventing
  readers with `office_scopes.read` but without broad `audit.read` from seeing
  a misleading 403 error.
- Vietnamese/Chinese labels, mobile card layout, empty/error states, and
  skeleton loading are included. Shared/backend/frontend typechecks and the
  Office A/Office B history policy tests pass.

## Rollout checklist

### Phase 0 - Inventory and safety net

- [x] Lock the business policy and non-transitive inheritance rules.
- [x] Inventory Firestore collections by protection class.
- [x] Inventory unsafe middleware, query, and realtime-listener patterns.
- [x] Add a machine-readable acceptance matrix for Office A, Office B, warehouse/store staff, and system admin.
- [x] Add an automated repository security audit in report mode.
- [x] Run the initial matrix validation and save the baseline audit result.

Phase 0 acceptance evidence:

- `security/facility-access-matrix.json`: 54 policy cases, validated by `pnpm test:access-matrix`.
- `security/firestore-protection-inventory.json`: canonical protection classes and denormalization blockers.
- `security/facility-access-baseline.json`: report-only baseline captured on 2026-07-15.
- Baseline findings: 41 unsafe authenticated Rules reads, 63 unbound any-scope guards, 58 unbound specific guards, 75 sensitive realtime references, 7 client-side access filters, and the active-user/cache/revocation gaps recorded by the audit.

### Phase 1 - Domain model and migration

- [x] Add shared types for office scope configuration, scope edges, effective grants, and access versioning.
- [x] Add validation schemas and collection constants.
- [x] Add repositories for scope configuration, edges, grants, and migration state.
- [x] Add an idempotent backfill command for workplace and legacy assignments.
- [x] Add dry-run, resumability, orphan detection, and audit output to the migration.

Phase 1 acceptance evidence:

- Versioned `user_access/{userId}/versions/{versionId}` snapshots reject
  mutation after activation, verify the complete grant manifest, and only
  advance the active version by one. `FAILED` snapshots remain auditable
  without blocking a recovery snapshot.
- Office-scope transactions enforce edge ownership and valid facility states,
  allow only `OFFICE -> MAIN|STORE`, and soft-deactivate every persisted edge
  when switching to `ALL`.
- `pnpm test:facility-access-planner`: 28 planner, version sequencing,
  office topology, lease, cursor, and crash-resume tests pass.
- `pnpm --filter @bduck/shared-types build`, shared typecheck, and backend typecheck pass.
- Apply mode requires an exact project confirmation; every domain mutation,
  audit record, source revalidation, lease check, cursor, and counter delta
  commits atomically. Dry-run has no write path.

### Phase 2 - Central backend authorization

- [x] Build one `AuthorizationService` for effective facility/action decisions.
- [x] Attach the access context in authenticated requests.
- [x] Replace resource authorization based only on `requireAnyScopedPermission`.
- [x] Scope users, employee profiles, roles, and assignments; prevent privilege escalation.
- [x] Scope inventory, locations, and stock policies.
- [x] Scope import/export vouchers and their child records.
- [x] Scope transfers using source/destination operation policy.
- [x] Scope stock counts, nonconformities, approvals, attendance, audit, expenses, and revenue.

Phase 2 acceptance evidence:

- Resource list/detail/mutation paths use `AuthorizationService` or a scoped
  service facade as the final facility/action boundary. Route middleware is a
  coarse gate only.
- User/profile/role delegation, inventory and locations, vouchers, transfers,
  stock counts, nonconformities, approvals, attendance, audit logs, expenses,
  revenue, and the external scan queue all resolve the resource facility before
  repository access or mutation.
- Revenue is restricted to `STORE`; inventory/storage/external scan actions
  reject `OFFICE`; transfer policy remains source/destination specific.
- `pnpm test:authorization` passes 80 assertions, identity security passes 31,
  scoped-query tests pass 6, and the 54-case access matrix passes.
- The remaining report-mode audit findings are Firestore Rules, frontend
  listener/cache work for phases 4 and 6, plus syntactic route coarse-gate
  references that are intentionally retained for defense in depth.

### Phase 3 - Materialized effective grants

- [x] Materialize per-user/per-facility grants with their source assignments.
- [x] Recompute grants transactionally when scopes, roles, workplaces, or user status change.
- [x] Increment `access_version` and write complete audit logs.
- [x] Add idempotency and repair/rebuild commands.

Phase 3 acceptance evidence:

- Effective grants are stored as immutable
  `user_access/{userId}/versions/{versionId}/facilities/{facilityId}` snapshots
  with facility type, permission map, and direct/inherited/system provenance.
- Activation re-reads the authorization source in the same transaction,
  validates its fingerprint and complete grant manifest, increments the version
  by exactly one, retires the previous version, changes the active pointer, and
  writes deterministic old/new audit data atomically.
- Scope, workplace, role, assignment, user status, profile, and facility
  mutations enqueue durable rebuild requests. Immediate rebuild failures remain
  repairable; inactive/deleted/invalid users receive an empty revocation snapshot.
- Per-user leases prevent concurrent builders. Matching staged versions are
  safely reused; stale staged versions are marked failed; failed attempts use a
  deterministic recovery suffix without hard deletion.
- `pnpm rebuild:user-access` is dry-run by default. Apply mode requires exact
  Firebase project confirmation and an initiating administrator.
- `pnpm test:facility-access-planner` passes 33 planner, sequencing,
  materialization, recovery, topology, lease, and crash-resume tests.

### Phase 4 - Grant-aware realtime and Firestore Rules

- [x] Add Firestore emulator security tests for every protection class.
- [x] Replace broad frontend listeners with grant-compatible queries.
- [x] Enforce user-private, global master-data, and facility-scoped rules.
- [x] Cover transfer source/destination and child collection access.
- [x] Remove blanket authenticated reads.

Phase 4 acceptance evidence:

- Firestore Rules resolve the current immutable `user_access` version, require
  matching active facility grants, and fail closed when the metadata pointer or
  `access_version` drifts.
- Facility listeners build `warehouse_id`/workplace/document-ID queries before
  subscribing, split Firestore `in` clauses at 30 values, and merge realtime
  snapshots without loading unauthorized facilities for client-side filtering.
- Inventory, facilities/locations/slots, users/profiles/assignments, vouchers,
  transfers, stock counts, nonconformities, approvals, attendance, expenses,
  revenue, notifications, and LAN transfers now follow their protection class.
- Voucher/transfer children inherit their parent facility boundary. Transfer
  reads allow source or destination grants; approval listeners use the
  configured `approval_warehouse_id` only.
- Revenue sync and dashboard cache documents use warehouse-qualified identity
  and a top-level `warehouse_id`; the supporting composite indexes are declared
  in `firestore.indexes.json`.
- `pnpm test:firestore-rules` runs ten emulator cases covering global master,
  global-admin configuration, facility-scoped, user-private/participant, and
  backend-only data, including Warehouse C/Store D isolation.
- The report-mode listener inventory decreased from 75 to 46 references after
  adding the two grant-constrained Office scope listeners. The
  remaining references are exact parent/child, recipient/participant, selected
  facility, or system-admin-only listeners; audit enforcement remains a Phase 7
  cutover task.

### Phase 5 - Office scope administration UI

- [x] Add an Office scope editor with `ALL` and `SELECTED` modes.
- [x] Group selectable targets into warehouses and stores.
- [x] Show effective scope, inherited/direct sources, affected employee count, and audit history.
- [x] Update employee/role forms to distinguish workplace, inherited scope, and exceptional direct grants.
- [x] Add mobile-native layouts, skeletons, i18n, and promise toasts.

Phase 5 acceptance evidence:

- `GET /api/office-scopes/:officeId` remains available to authorized office
  viewers. `PUT /api/office-scopes/:officeId` accepts a system administrator or
  an own-Office manager with `office_scopes.write`, then validates every target
  against the system-admin-configured ceiling.
- Office detail renders a responsive scope editor, separates MAIN warehouses
  from STORE facilities, previews the effective facilities, and shows the
  affected employee count and facility audit timeline.
- Scope writes use the existing transaction/materialization pipeline and audit
  both the previous and next selected facility IDs. Firestore listeners watch
  only the authorized office config and its `office_id`-constrained edges.
- User and employee forms now require a workplace, show the materialized
  effective grants with `OFFICE_INHERITED`/direct source labels, and keep direct
  role assignments in an advanced exception section. Non-system managers are
  not offered a global assignment option.
- Vietnamese and Chinese labels, skeleton states, mobile stacking, disabled
  pending controls, and retryable `goey-toast` mutations are included.
- Shared/backend/frontend typechecks, the ten-case Firestore Rules emulator
  suite, and the backend security-foundation suite pass.

### Phase 6 - Revocation and offline cache

- [x] Subscribe to the current user's access metadata and react to `access_version` changes.
- [x] Cancel and recreate listeners immediately after a scope change.
- [x] Isolate or clear sensitive persistent cache on logout and account switching.
- [x] Verify offline revocation and shared-device scenarios.

Phase 6 acceptance evidence:

- `AccessVersionProvider` listens to the authenticated user's exact
  `user_access/{uid}` document. It ignores cache-only metadata, reads the active
  immutable grant collection from the server, validates user/version/count,
  and then atomically replaces frontend permissions.
- A version change or reconnect first clears permissions and increments the
  access epoch. The dashboard subtree unmounts while access is verified, which
  cancels its previous Firestore listeners; the new subtree mounts only after
  the server-confirmed scope is applied.
- The legacy 12-hour authorization delay is removed. Firebase token changes,
  focus, visibility, and reconnect still validate the backend session, while
  authorization revocation is driven by realtime `access_version` changes.
- Firestore uses memory-only cache, the legacy shared Zustand permission cache
  is removed, and old Firestore IndexedDB databases are purged. Receiving
  drafts remain local-first but are migrated to an account-qualified
  `userId:voucherId` key and async loads are discarded after account changes.
- A verified session may continue with its in-memory snapshot while offline.
  On reconnect, permissions are removed before server verification, so a
  revocation made while offline takes effect before scoped listeners return.
  A fresh offline session without a server-confirmed access snapshot fails
  closed behind the dashboard skeleton.
- `pnpm test:access-session` passes the version-revocation, stale-grant,
  shared-device, and offline lifecycle assertions. Frontend typecheck passes,
  and `pnpm security:audit:summary` no longer reports
  `shared-sensitive-persistent-cache` or
  `delayed-access-revocation-refresh`.

### Phase 7 - Shadow rollout and cutover

- [x] Log old/new authorization differences without blocking requests.
- [x] Resolve data and policy mismatches found by the repository audit.
- [x] Cut backend authorization over first, then listeners and Firestore Rules.
- [x] Enable repository security audit enforcement.
- [x] Remove legacy scope parsing and global fallbacks.

Phase 7 implementation evidence:

- `FACILITY_AUTHORIZATION_MODE=SHADOW` serves the live role-built context while
  comparing it with the active `user_access` version. Missing, invalid, and
  mismatched snapshots are aggregated idempotently in
  `authorization_shadow_diffs`; logging failures never block the request.
- `FACILITY_AUTHORIZATION_MODE=MATERIALIZED` is the default and fail-closed
  cutover. The request authorization path does not call the raw role builder
  in this mode. Invalid, missing, count-mismatched, or fingerprint-mismatched
  snapshots are rejected.
- Frontend listeners and Firestore Rules already consume the active
  materialized grant. `access_version` changes remount scoped listeners, so
  backend, browser queries, and Rules now share the same effective snapshot.
- Attendance, report export, and process configuration no longer parse
  `req.user.permissions`. Report inventory fields query `findAllScoped` from
  the repository instead of reading all inventory and filtering afterward.
- Login no longer returns a role-derived permission map. Role assignments are
  retained only as identity/workflow compatibility metadata; UI permissions
  are populated by the verified `user_access` listener.
- `pnpm security:audit` now runs with enforcement. Coarse route gates and
  listener references remain visible as observations, while actual policy
  violations fail the command. The enforced result is zero findings.

Operational promotion remains deliberate: deploy `SHADOW`, inspect and repair
all open diff groups, rebuild affected users, then deploy `MATERIALIZED`.
Switching the environment value back to `SHADOW` is a temporary rollback of
the serving decision; it does not modify or delete materialized history.

### Phase 8 - End-to-end verification

Test catalog và tiêu chí bằng chứng được định nghĩa tại
`docs/facility-partition-test-cases.md`. Chạy toàn bộ automated partition suite
bằng `pnpm test:facility-partition` trước khi thực hiện UAT trên môi trường có
dữ liệu thật.

- [ ] Verify Office A dynamic-all access.
- [ ] Verify Office B can access only Warehouse C and Store D.
- [ ] Verify warehouse/store staff self-scope.
- [ ] Verify user move, scope revoke, disabled user, deep links, direct Firestore access, and offline cache.
- [ ] Verify transfer source/destination actions and privilege-escalation denial.
- [ ] Complete operational and recovery documentation.

## Firestore protection inventory

The canonical, machine-readable inventory is `security/firestore-protection-inventory.json`. The lists below are a review summary; new collections must be classified in the JSON inventory before they are introduced.

### Global authenticated master data

These records may be shared across facilities but writes remain permission-controlled:

- `product_categories`
- `products`
- `product_bom`
- `organizations` (pending confirmation if suppliers become facility-owned)

### Global administrator configuration

- `roles`
- `workflow_definitions` and `versions`
- `process_configs`
- `file_templates`
- `report_templates` and `report_template_versions` (owner/private visibility is enforced separately)
- `system_configs` and `openapi_warehouse_configs`

### Facility-scoped data

- `warehouses`
- `warehouse_locations`
- `warehouse_location_slots`
- `warehouse_location_slot_products`
- `users` (through denormalized workplace facility)
- `employee_profiles`
- `user_warehouse_roles`
- `office_scope_configs`, `office_scope_edges`, `office_scope_ceilings`, and
  public `office_scope_materializations`
- `audit_logs`
- `vouchers`
- `inventory`
- `inventory_stock_policies`
- `warehouse_attendance_policies`
- `warehouse_attendance_exemptions`
- `attendance_logs`
- `attendance_late_reports`
- `workflow_instances` and `tasks`
- `import_vouchers` and `items`
- `export_vouchers` and `items`
- `transfer_orders` and `items`
- `nonconformity_reports`
- `quarantine_records`
- `stock_count_sessions`
- `stock_count_items`
- `pending_approvals`
- `external_scan_queue` and `external_queue_scannable_products`
- purchase, adjustment, gift-export, and POS documents/items
- `report_exports`
- `expenses`
- `revenue_sync`
- `revenue_dashboards`, `orders`, and `sold_items`

### User-private or participant-only data

- `in_app_notifications`
- `notification_dispatches`
- `notification_push_tokens`
- `user_access` metadata and immutable version/facility subcollections
- `lan_transfer_presence`
- `lan_transfer_requests` and `signals`

### Backend-only internal data

- `account_invitations`
- `integration_clients`
- `counters`
- `office_scope_materialization_jobs`
- migration state documents

### Required denormalization before secure Rules

| Collection/resource               | Required access discriminator                              |
| --------------------------------- | ---------------------------------------------------------- |
| `users`                           | `workplace_facility_id`                                    |
| `stock_count_items`               | `warehouse_id` copied from the session                     |
| `quarantine_records`              | `warehouse_id` copied from the report                      |
| facility `audit_logs`             | required `facility_id`; null is global-admin only          |
| attachments                       | `access_class` and `facility_id`, or backend-only delivery |
| legacy workflow instances/tasks   | `facility_id`, or backend/admin-only access                |
| revenue dashboard parent/children | Resolved in Phase 4 with top-level `warehouse_id`          |

`revenue_sync` identity is aligned in Phase 4: both backend and frontend use
`{warehouseId}_{period}`, and every document carries top-level `warehouse_id`.

## Transfer operation policy

| Operation                 | Required facility scope                     |
| ------------------------- | ------------------------------------------- |
| Read/list                 | Source or destination with `transfers.read` |
| Create/update/cancel/pick | Source with `transfers.write`               |
| Receive/confirm receipt   | Destination with `transfers.receive`        |
| Approve/reject            | Facility configured for that approval step  |
