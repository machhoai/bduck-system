import assert from "node:assert/strict";
import test from "node:test";

import {
  EmployeeContractType,
  getNextContractLocalDate,
} from "@bduck/shared-types";

const addDays = (date: string, count: number): string => {
  let result: string | null = date;
  for (let index = 0; index < count; index += 1) {
    if (!result) throw new Error("Unable to calculate test LocalDate.");
    result = getNextContractLocalDate(result);
    if (!result) throw new Error("Unable to calculate test LocalDate.");
  }
  return result;
};

const hasErrorCode = (error: unknown, code: string): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code,
  );

test(
  "contract transactions keep number locks, revision and audit atomic",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { getVietnamLocalDate },
      { createEmployeeContractRecord, updateEmployeeContractRecord },
      { renewEmployeeContractRecord },
      { cancelEmployeeContractRecord, terminateEmployeeContractRecord },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("../services/employeeEmploymentPolicy.js"),
      import("./employeeContractMutationRepository.js"),
      import("./employeeContractRenewalRepository.js"),
      import("./employeeContractLifecycleRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const employeeA = `contract-employee-a-${suffix}`;
    const employeeB = `contract-employee-b-${suffix}`;
    const workplace = `contract-workplace-${suffix}`;
    const today = getVietnamLocalDate();
    const sourceEnd = addDays(today, 2);
    const renewalStart = addDays(sourceEnd, 1);
    const renewalEnd = addDays(renewalStart, 30);
    const actionTime = new Date();
    const actorId = `contract-actor-${suffix}`;

    await Promise.all(
      [employeeA, employeeB].map((id) =>
        db.collection("employee_profiles").doc(id).set({
          id,
          user_id: null,
          workplace_warehouse_id: workplace,
          is_deleted: false,
        }),
      ),
    );

    const context = (idempotencyKey: string) => ({
      actor_id: actorId,
      action_time: actionTime,
      idempotency_key: idempotencyKey,
      ip_address: "127.0.0.1",
    });
    const sourceInput = {
      contract_number: `HD-A-${suffix}`,
      contract_type: EmployeeContractType.FIXED_TERM,
      start_date: today,
      end_date: sourceEnd,
      notes: null,
      idempotency_key: `create-a-${suffix}`,
      action_time: actionTime,
    };
    const created = await createEmployeeContractRecord({
      employee_profile_id: employeeA,
      workplace_warehouse_id: workplace,
      contract: sourceInput,
      context: context(sourceInput.idempotency_key),
    });
    const replay = await createEmployeeContractRecord({
      employee_profile_id: employeeA,
      workplace_warehouse_id: workplace,
      contract: sourceInput,
      context: context(sourceInput.idempotency_key),
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.contract.id, created.contract.id);

    await assert.rejects(
      createEmployeeContractRecord({
        employee_profile_id: employeeB,
        workplace_warehouse_id: workplace,
        contract: {
          ...sourceInput,
          idempotency_key: `duplicate-${suffix}`,
        },
        context: context(`duplicate-${suffix}`),
      }),
      (error) => hasErrorCode(error, "CONTRACT_NUMBER_DUPLICATE"),
    );

    const rollbackNumber = `HD-ROLLBACK-${suffix}`;
    await assert.rejects(
      createEmployeeContractRecord({
        employee_profile_id: employeeA,
        workplace_warehouse_id: workplace,
        contract: {
          ...sourceInput,
          contract_number: rollbackNumber,
          idempotency_key: `overlap-${suffix}`,
        },
        context: context(`overlap-${suffix}`),
      }),
      (error) => hasErrorCode(error, "CONTRACT_PERIOD_OVERLAP"),
    );
    await createEmployeeContractRecord({
      employee_profile_id: employeeB,
      workplace_warehouse_id: workplace,
      contract: {
        ...sourceInput,
        contract_number: rollbackNumber,
        idempotency_key: `create-b-${suffix}`,
      },
      context: context(`create-b-${suffix}`),
    });

    await assert.rejects(
      updateEmployeeContractRecord({
        employee_profile_id: employeeA,
        workplace_warehouse_id: workplace,
        contract_id: created.contract.id,
        patch: {
          notes: "Stale",
          expected_revision: 99,
          idempotency_key: `stale-${suffix}`,
          action_time: actionTime,
        },
        context: context(`stale-${suffix}`),
      }),
      (error) => hasErrorCode(error, "CONTRACT_REVISION_CONFLICT"),
    );

    const renewed = await renewEmployeeContractRecord({
      employee_profile_id: employeeA,
      workplace_warehouse_id: workplace,
      source_contract_id: created.contract.id,
      contract: {
        contract_number: `HD-C-${suffix}`,
        contract_type: EmployeeContractType.FIXED_TERM,
        start_date: renewalStart,
        end_date: renewalEnd,
        notes: null,
        expected_revision: 1,
        idempotency_key: `renew-${suffix}`,
        action_time: actionTime,
      },
      context: context(`renew-${suffix}`),
    });
    assert.equal(renewed.source_contract?.revision, 2);

    const cancelled = await cancelEmployeeContractRecord({
      employee_profile_id: employeeA,
      workplace_warehouse_id: workplace,
      contract_id: renewed.contract.id,
      request: {
        reason: "Hai bên thống nhất",
        expected_revision: 1,
        idempotency_key: `cancel-${suffix}`,
        action_time: actionTime,
      },
      context: context(`cancel-${suffix}`),
    });
    assert.equal(cancelled.contract.revision, 2);

    const terminated = await terminateEmployeeContractRecord({
      employee_profile_id: employeeA,
      workplace_warehouse_id: workplace,
      contract_id: created.contract.id,
      request: {
        reason: "Thanh lý trước hạn",
        termination_date: today,
        expected_revision: 2,
        idempotency_key: `terminate-${suffix}`,
        action_time: actionTime,
      },
      context: context(`terminate-${suffix}`),
    });
    assert.equal(terminated.contract.revision, 3);

    const [locks, audits, operations] = await Promise.all([
      db
        .collection("employee_contract_number_locks")
        .where("workplace_warehouse_id", "==", workplace)
        .get(),
      db
        .collection("audit_logs")
        .where("warehouse_id", "==", workplace)
        .where("entity_type", "==", "employee_contracts")
        .get(),
      db
        .collection("employee_contract_operations")
        .where("actor_id", "==", actorId)
        .get(),
    ]);
    assert.equal(locks.size, 3);
    assert.equal(audits.size, 6);
    assert.equal(operations.size, 5);

    const employeeC = `contract-employee-c-${suffix}`;
    const concurrentWorkplace = `contract-concurrent-${suffix}`;
    await db.collection("employee_profiles").doc(employeeC).set({
      id: employeeC,
      user_id: null,
      workplace_warehouse_id: concurrentWorkplace,
      is_deleted: false,
    });
    const overlapping = await Promise.allSettled(
      ["ONE", "TWO"].map((marker) =>
        createEmployeeContractRecord({
          employee_profile_id: employeeC,
          workplace_warehouse_id: concurrentWorkplace,
          contract: {
            ...sourceInput,
            contract_number: `HD-CONCURRENT-${marker}-${suffix}`,
            idempotency_key: `overlap-concurrent-${marker}-${suffix}`,
          },
          context: context(`overlap-concurrent-${marker}-${suffix}`),
        }),
      ),
    );
    assert.equal(
      overlapping.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      overlapping.filter(
        (result) =>
          result.status === "rejected" &&
          hasErrorCode(result.reason, "CONTRACT_PERIOD_OVERLAP"),
      ).length,
      1,
    );

    const employeeD = `contract-employee-d-${suffix}`;
    const employeeE = `contract-employee-e-${suffix}`;
    await Promise.all(
      [employeeD, employeeE].map((id) =>
        db
          .collection("employee_profiles")
          .doc(id)
          .set({
            id,
            user_id: null,
            workplace_warehouse_id: `${id}-workplace`,
            is_deleted: false,
          }),
      ),
    );
    const sharedNumber = `HD-GLOBAL-CONCURRENT-${suffix}`;
    const globallyUnique = await Promise.allSettled(
      [employeeD, employeeE].map((employeeId) =>
        createEmployeeContractRecord({
          employee_profile_id: employeeId,
          workplace_warehouse_id: `${employeeId}-workplace`,
          contract: {
            ...sourceInput,
            contract_number: sharedNumber,
            idempotency_key: `global-${employeeId}`,
          },
          context: context(`global-${employeeId}`),
        }),
      ),
    );
    assert.equal(
      globallyUnique.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      globallyUnique.filter(
        (result) =>
          result.status === "rejected" &&
          hasErrorCode(result.reason, "CONTRACT_NUMBER_DUPLICATE"),
      ).length,
      1,
    );
  },
);
