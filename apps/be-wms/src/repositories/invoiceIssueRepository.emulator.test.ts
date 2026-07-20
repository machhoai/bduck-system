import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceOrderMatchStatus,
} from "@bduck/shared-types";

test(
  "issue transaction survives double-click, duplicate task, worker death and shared lane",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, { invoiceIssueRepository }] = await Promise.all([
      import("../config/firebase.js"),
      import("./invoiceIssueRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const warehouse1 = `phase4-store-a-${suffix}`;
    const warehouse2 = `phase4-store-b-${suffix}`;
    const accountId = `phase4-account-${suffix}`;
    const invSeries = "1C26TST";

    const seed = async (documentId: string, warehouseId: string) => {
      await Promise.all([
        db.collection("invoice_documents").doc(documentId).set({
          id: documentId,
          warehouse_id: warehouseId,
          status: InvoiceDocumentStatus.READY_TO_ISSUE,
          issue_eligible: true,
          revision: 1,
          source_payload_hash: `hash-${documentId}`,
          financially_edited: false,
          active_issue_job_id: null,
          is_deleted: false,
        }),
        db.collection("invoice_source_orders").doc(documentId).set({
          id: documentId,
          warehouse_id: warehouseId,
          source_payload_hash: `hash-${documentId}`,
          match_status: InvoiceOrderMatchStatus.NOT_CHECKED,
          is_deleted: false,
        }),
      ]);
    };
    const prepared = (documentId: string, refId: string) => ({
      documentId,
      sourceOrderId: `source-${documentId}`,
      sourcePayloadHash: `hash-${documentId}`,
      revision: 1,
      refId,
      payloadHash: `payload-hash-${documentId}`,
      payload: { RefID: refId, InvSeries: invSeries },
    });

    const document1 = `phase4-document-a-${suffix}`;
    const document2 = `phase4-document-b-${suffix}`;
    const document3 = `phase4-document-c-${suffix}`;
    await Promise.all([
      seed(document1, warehouse1),
      seed(document2, warehouse2),
      seed(document3, warehouse2),
    ]);
    const common = {
      accountId,
      invSeries,
      signType: 2,
      invoiceWithCode: true,
      invoiceCalculatingMachine: false,
      actorId: "phase4-test-issuer",
    };
    const job1 = `phase4-job-a-${suffix}`;
    const job2 = `phase4-job-b-${suffix}`;
    const ref1 = `phase4-ref-a-${suffix}`;
    const ref2 = `phase4-ref-b-${suffix}`;
    const first = await invoiceIssueRepository.createJob({
      ...common,
      jobId: job1,
      warehouseId: warehouse1,
      idempotencyKey: `request-a-${suffix}`,
      items: [prepared(document1, ref1)],
    });
    const doubleClick = await invoiceIssueRepository.createJob({
      ...common,
      jobId: job1,
      warehouseId: warehouse1,
      idempotencyKey: `request-a-${suffix}`,
      items: [prepared(document1, ref1)],
    });
    assert.equal(first.created, true);
    assert.equal(doubleClick.created, false);

    await invoiceIssueRepository.createJob({
      ...common,
      jobId: job2,
      warehouseId: warehouse2,
      idempotencyKey: `request-b-${suffix}`,
      items: [prepared(document2, ref2)],
    });
    const claim1 = await invoiceIssueRepository.claimItem(job1, document1, "worker-a");
    assert.equal(claim1?.busy, false);
    const duplicateTask = await invoiceIssueRepository.claimItem(job1, document1, "worker-b");
    assert.equal(duplicateTask?.busy, true);
    const sharedLane = await invoiceIssueRepository.claimItem(job2, document2, "worker-b");
    assert.equal(sharedLane?.busy, true);

    const laneId = (claim1 && !claim1.busy) ? claim1.laneId : "";
    await db.collection("invoice_queue_lanes").doc(laneId).update({
      lease_expires_at: new Date(Date.now() - 1_000),
    });
    const recovered = await invoiceIssueRepository.claimItem(job1, document1, "worker-recovery");
    assert.equal(recovered?.busy, false);
    if (!recovered || recovered.busy) throw new Error("recovery claim failed");
    assert.equal(recovered.previousStatus, InvoiceIssueItemStatus.PENDING_CONFIRMATION);
    await invoiceIssueRepository.completeItem({
      jobId: job1,
      itemId: document1,
      owner: "worker-recovery",
      status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
      nextAttemptAt: new Date(Date.now() + 60_000),
    });

    const afterRelease = await invoiceIssueRepository.claimItem(job2, document2, "worker-c");
    assert.equal(afterRelease?.busy, false);
    await invoiceIssueRepository.completeItem({
      jobId: job2,
      itemId: document2,
      owner: "worker-c",
      status: InvoiceIssueItemStatus.CANCELLED,
      nextAttemptAt: null,
    });

    await assert.rejects(
      invoiceIssueRepository.createJob({
        ...common,
        jobId: `phase4-job-c-${suffix}`,
        warehouseId: warehouse2,
        idempotencyKey: `request-c-${suffix}`,
        items: [prepared(document3, ref1)],
      }),
      /INVOICE_REF_ALREADY_RESERVED/u,
    );
  },
);
