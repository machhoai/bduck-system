import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
  addContractLocalDays,
  type EmployeeContract,
  type EmployeeContractAutomationResult,
} from "@bduck/shared-types";

test(
  "automation locks make status, scheduler and warning writes idempotent",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, repository, warningRepository] = await Promise.all([
      import("../config/firebase.js"),
      import("./employeeContractAutomationRepository.js"),
      import("./employeeContractExpiryNotificationRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const contractId = `automation-contract-${suffix}`;
    const asOfDate = "2026-07-29";
    const endDate = addContractLocalDays(asOfDate, 30);
    assert.ok(endDate);
    const now = new Date();
    const contract: EmployeeContract = {
      id: contractId,
      employee_profile_id: `profile-${suffix}`,
      employee_user_id: `employee-${suffix}`,
      workplace_warehouse_id: `facility-${suffix}`,
      contract_number: `HD-${suffix}`,
      contract_number_normalized: `HD-${suffix}`.toUpperCase(),
      contract_type: EmployeeContractType.FIXED_TERM,
      start_date: "2026-01-01",
      end_date: endDate,
      status: EmployeeContractStatus.UPCOMING,
      renewed_from_contract_id: null,
      root_contract_id: contractId,
      renewal_sequence: 0,
      termination_date: null,
      termination_reason: null,
      terminated_by: null,
      terminated_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      notes: null,
      revision: 1,
      created_by: "test",
      updated_by: "test",
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: now,
      sync_time: now,
    };
    await db.collection("employee_contracts").doc(contractId).set(contract);

    assert.equal(
      await repository.synchronizeEmployeeContractStatus(
        contractId,
        asOfDate,
        "scheduler",
      ),
      "UPDATED",
    );
    assert.equal(
      await repository.synchronizeEmployeeContractStatus(
        contractId,
        asOfDate,
        "scheduler",
      ),
      "REPLAYED",
    );
    const stored = await db
      .collection("employee_contracts")
      .doc(contractId)
      .get();
    assert.equal(stored.get("status"), EmployeeContractStatus.ACTIVE);
    assert.equal(stored.get("revision"), 2);

    const firstWarning =
      await warningRepository.createEmployeeContractExpiryWarning(
      contractId,
      asOfDate,
      [`hr-a-${suffix}`, `hr-b-${suffix}`],
      "scheduler",
    );
    const replayedWarning =
      await warningRepository.createEmployeeContractExpiryWarning(
        contractId,
        asOfDate,
        [`hr-a-${suffix}`, `hr-b-${suffix}`],
        "scheduler",
      );
    assert.equal(firstWarning.created, true);
    assert.equal(firstWarning.notifications.length, 2);
    assert.equal(replayedWarning.created, false);

    const claim = await repository.claimEmployeeContractAutomationRun(
      asOfDate,
    );
    assert.equal(claim.claimed, true);
    const concurrent = await repository.claimEmployeeContractAutomationRun(
      asOfDate,
    );
    assert.equal(concurrent.claimed, false);
    assert.equal(concurrent.result, null);
    const result: EmployeeContractAutomationResult = {
      as_of_date: asOfDate,
      status_checked: 1,
      status_updated: 1,
      status_skipped: 0,
      warning_candidates: 1,
      warnings_created: 1,
      warning_recipients: 2,
      warning_skipped: 0,
      replayed: false,
      in_progress: false,
    };
    await repository.completeEmployeeContractAutomationRun(
      claim.runId,
      result,
    );
    const completed = await repository.claimEmployeeContractAutomationRun(
      asOfDate,
    );
    assert.equal(completed.claimed, false);
    assert.deepEqual(completed.result, result);
  },
);
