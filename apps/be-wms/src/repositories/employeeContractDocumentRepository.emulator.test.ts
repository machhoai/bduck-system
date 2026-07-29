import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  EmployeeContractStatus,
  EmployeeContractType,
} from "@bduck/shared-types";

test(
  "document transactions preserve versions, idempotency and atomic audit",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { createEmployeeContractDocumentUploadIntentRecord },
      { finalizeEmployeeContractDocumentRecord },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("./employeeContractDocumentIntentRepository.js"),
      import("./employeeContractDocumentMutationRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const profileId = randomUUID();
    const contractId = randomUUID();
    const workplaceId = `document-workplace-${suffix}`;
    const actorId = `document-actor-${suffix}`;
    const employeeUserId = `document-employee-${suffix}`;
    const now = new Date();
    await db.collection("employee_profiles").doc(profileId).set({
      id: profileId,
      user_id: employeeUserId,
      workplace_warehouse_id: workplaceId,
      is_deleted: false,
    });
    await db
      .collection("employee_contracts")
      .doc(contractId)
      .set({
        id: contractId,
        employee_profile_id: profileId,
        employee_user_id: employeeUserId,
        workplace_warehouse_id: workplaceId,
        contract_number: `HD-PDF-${suffix}`,
        contract_number_normalized: `HD-PDF-${suffix}`.toUpperCase(),
        contract_type: EmployeeContractType.FIXED_TERM,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: EmployeeContractStatus.ACTIVE,
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
        created_by: actorId,
        updated_by: actorId,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        action_time: now,
        sync_time: now,
      });
    const context = (idempotencyKey: string) => ({
      actor_id: actorId,
      idempotency_key: idempotencyKey,
      action_time: now,
      ip_address: "127.0.0.1",
    });
    const intentId = (key: string) =>
      createHash("sha256").update(key).digest("hex");
    const createIntent = async (key: string, fileName: string) => {
      const id = intentId(`${actorId}:${key}`);
      return createEmployeeContractDocumentUploadIntentRecord({
        employee_profile_id: profileId,
        workplace_warehouse_id: workplaceId,
        contract_id: contractId,
        original_file_name: fileName,
        intent_id: id,
        upload_storage_path: `employee-contract-uploads/${profileId}/${contractId}/${id}/${fileName}`,
        expires_at: new Date(Date.now() + 60_000),
        context: context(key),
      });
    };

    const firstIntent = await createIntent("upload-v1", "contract-v1.pdf");
    const firstResult = await finalizeEmployeeContractDocumentRecord({
      employee_profile_id: profileId,
      workplace_warehouse_id: workplaceId,
      contract_id: contractId,
      intent_id: firstIntent.id,
      persisted: {
        storage_path: `employee-contract-documents/${profileId}/${contractId}/${firstIntent.id}/hash-v1.pdf`,
        storage_generation: "101",
        file_size: 100,
        sha256: "a".repeat(64),
      },
      context: context("finalize-v1"),
    });
    const replay = await finalizeEmployeeContractDocumentRecord({
      employee_profile_id: profileId,
      workplace_warehouse_id: workplaceId,
      contract_id: contractId,
      intent_id: firstIntent.id,
      persisted: {
        storage_path: "must-not-replace-the-finalized-version",
        storage_generation: "999",
        file_size: 999,
        sha256: "f".repeat(64),
      },
      context: context("finalize-v1-replay"),
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.document.id, firstResult.document.id);
    assert.equal(
      replay.document.storage_path,
      firstResult.document.storage_path,
    );

    const secondIntent = await createIntent("upload-v2", "contract-v2.pdf");
    const secondResult = await finalizeEmployeeContractDocumentRecord({
      employee_profile_id: profileId,
      workplace_warehouse_id: workplaceId,
      contract_id: contractId,
      intent_id: secondIntent.id,
      persisted: {
        storage_path: `employee-contract-documents/${profileId}/${contractId}/${secondIntent.id}/hash-v2.pdf`,
        storage_generation: "102",
        file_size: 120,
        sha256: "b".repeat(64),
      },
      context: context("finalize-v2"),
    });

    const [thirdIntent, fourthIntent] = await Promise.all([
      createIntent("upload-v3", "contract-v3.pdf"),
      createIntent("upload-v4", "contract-v4.pdf"),
    ]);
    const concurrentResults = await Promise.all([
      finalizeEmployeeContractDocumentRecord({
        employee_profile_id: profileId,
        workplace_warehouse_id: workplaceId,
        contract_id: contractId,
        intent_id: thirdIntent.id,
        persisted: {
          storage_path: `employee-contract-documents/${profileId}/${contractId}/${thirdIntent.id}/hash-v3.pdf`,
          storage_generation: "103",
          file_size: 130,
          sha256: "c".repeat(64),
        },
        context: context("finalize-v3"),
      }),
      finalizeEmployeeContractDocumentRecord({
        employee_profile_id: profileId,
        workplace_warehouse_id: workplaceId,
        contract_id: contractId,
        intent_id: fourthIntent.id,
        persisted: {
          storage_path: `employee-contract-documents/${profileId}/${contractId}/${fourthIntent.id}/hash-v4.pdf`,
          storage_generation: "104",
          file_size: 140,
          sha256: "d".repeat(64),
        },
        context: context("finalize-v4"),
      }),
    ]);
    assert.deepEqual(
      concurrentResults
        .map((result) => result.document.version)
        .sort((left, right) => left - right),
      [3, 4],
    );

    const [documents, audits] = await Promise.all([
      db
        .collection("employee_contract_documents")
        .where("contract_id", "==", contractId)
        .get(),
      db
        .collection("audit_logs")
        .where("warehouse_id", "==", workplaceId)
        .where("entity_type", "in", [
          "employee_contract_documents",
          "employee_contract_document_upload_intents",
        ])
        .get(),
    ]);
    assert.equal(documents.size, 4);
    const versions = documents.docs
      .map((snapshot) => snapshot.data())
      .sort((left, right) => left.version - right.version);
    assert.deepEqual(
      versions.map((document) => [document.version, document.is_current]),
      [
        [1, false],
        [2, false],
        [3, false],
        [4, true],
      ],
    );
    assert.equal(versions[0].storage_path, firstResult.document.storage_path);
    assert.equal(versions[1].storage_path, secondResult.document.storage_path);
    for (const document of versions) {
      assert.equal("url" in document, false);
      assert.equal("download_url" in document, false);
    }
    assert.equal(audits.size, 15);
  },
);
