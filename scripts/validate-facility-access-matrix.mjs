import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const matrixUrl = new URL(
  "../security/facility-access-matrix.json",
  import.meta.url,
);
const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));

assert.equal(matrix.version, 1, "Unsupported facility access matrix version");
assert.ok(matrix.policyVersion, "The matrix requires a policy version");
assert.ok(
  Object.keys(matrix.facilities).length >= 8,
  "The matrix must model current and future facility variants",
);
assert.ok(
  Object.keys(matrix.actors).length >= 10,
  "The matrix must model all required actor states",
);

for (const [actorId, actor] of Object.entries(matrix.actors)) {
  assert.equal(
    typeof actor.active,
    "boolean",
    `Missing active state for ${actorId}`,
  );
  assert.ok(actor.workplace, `Missing workplace for ${actorId}`);
  assert.ok(
    matrix.facilities[actor.workplace],
    `Unknown workplace for ${actorId}`,
  );
  assert.ok(
    Array.isArray(actor.permissions),
    `Missing permissions for ${actorId}`,
  );
  assert.ok(
    Array.isArray(actor.facilities),
    `Missing facilities for ${actorId}`,
  );
}

const caseIds = new Set();
for (const testCase of matrix.cases) {
  assert.ok(testCase.id, "Every case requires a stable id");
  assert.equal(
    caseIds.has(testCase.id),
    false,
    `Duplicate case id: ${testCase.id}`,
  );
  caseIds.add(testCase.id);
  if (testCase.actor !== null) {
    assert.ok(
      matrix.actors[testCase.actor],
      `Unknown actor: ${testCase.actor}`,
    );
  }
  if (testCase.previousActor) {
    assert.ok(
      matrix.actors[testCase.previousActor],
      `Unknown previousActor: ${testCase.previousActor}`,
    );
  }
  assert.ok(testCase.action, `Missing action for ${testCase.id}`);
  assert.equal(
    typeof testCase.allowed,
    "boolean",
    `Missing expected decision for ${testCase.id}`,
  );

  for (const facilityField of [
    "facility",
    "sourceFacility",
    "destinationFacility",
  ]) {
    const facilityId = testCase[facilityField];
    if (facilityId) {
      assert.ok(
        matrix.facilities[facilityId],
        `Unknown ${facilityField}: ${facilityId}`,
      );
    }
  }
}

const requiredCases = [
  "unauthenticated_is_denied",
  "office_a_all_includes_future_store",
  "office_a_all_excludes_future_office",
  "office_a_cannot_manage_other_office",
  "office_b_cannot_read_outside_scope",
  "office_b_cannot_see_other_office",
  "scope_without_action_is_denied",
  "action_outside_scope_is_denied",
  "disabled_user_is_denied",
  "soft_deleted_user_is_denied",
  "expired_assignment_is_denied",
  "warehouse_staff_reads_self",
  "store_staff_reads_self_revenue",
  "warehouse_cannot_be_revenue_target",
  "transfer_read_requires_one_endpoint",
  "transfer_write_source_allowed",
  "transfer_write_requires_source",
  "transfer_receive_destination_allowed",
  "transfer_receive_requires_destination",
  "creator_does_not_bypass_scope",
  "self_approval_is_denied",
  "cannot_grant_outside_scope",
  "cannot_grant_unowned_action",
  "cannot_grant_global",
  "revoked_inherited_scope_is_denied",
  "moved_employee_loses_old_office_scope",
  "moved_employee_gets_new_workplace_scope",
  "deep_link_outside_scope_is_denied",
  "direct_firestore_outside_scope_is_denied",
  "broad_firestore_query_is_denied",
  "facility_constrained_firestore_query_is_allowed",
  "offline_revocation_does_not_render_cached_data",
  "account_switch_does_not_reuse_previous_cache",
];

for (const caseId of requiredCases) {
  assert.ok(
    caseIds.has(caseId),
    `Required security case is missing: ${caseId}`,
  );
}

assert.ok(
  matrix.cases.length >= requiredCases.length,
  "The matrix must cover every required policy case",
);

console.log(
  `Validated ${matrix.cases.length} facility access policy cases for ${matrix.policyVersion}.`,
);
