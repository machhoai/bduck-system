import { db } from "../config/firebase.js";

const documents = db.collection("invoice_documents");
const sourceOrders = db.collection("invoice_source_orders");

const serviceError = (
  statusCode: number,
  vi: string,
  zh: string,
  code: string,
) => ({ statusCode, messages: { vi, zh }, data: { code } });

const assertScopedDocument = (
  value: Record<string, unknown> | undefined,
  warehouseId: string,
) => {
  if (
    !value ||
    value.warehouse_id !== warehouseId ||
    value.is_deleted === true
  ) {
    throw serviceError(
      404,
      "Không tìm thấy bản nháp hóa đơn.",
      "找不到发票草稿。",
      "INVOICE_DOCUMENT_NOT_FOUND",
    );
  }
};

const assertRevision = (
  value: Record<string, unknown>,
  expectedRevision: number,
) => {
  if (value.revision !== expectedRevision) {
    throw serviceError(
      409,
      "Bản nháp đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
      "发票草稿已更改，请重新加载后再继续。",
      "INVOICE_REVISION_CONFLICT",
    );
  }
};

const assertSourceFresh = (
  source: Record<string, unknown> | undefined,
  document: Record<string, unknown>,
  expectedSourcePayloadHash: string,
) => {
  if (
    !source ||
    source.is_deleted === true ||
    source.warehouse_id !== document.warehouse_id ||
    source.source_payload_hash !== expectedSourcePayloadHash ||
    document.source_payload_hash !== expectedSourcePayloadHash
  ) {
    throw serviceError(
      409,
      "Dữ liệu đơn hàng nguồn đã thay đổi. Vui lòng đồng bộ và tạo lại bản nháp.",
      "源订单数据已更改，请同步并重新生成草稿。",
      "INVOICE_SOURCE_STALE",
    );
  }
};

const revisionSnapshot = (document: Record<string, unknown>) => ({
  revision: document.revision,
  status: document.status,
  buyer: document.buyer,
  payment_method_name: document.payment_method_name,
  items: document.items,
  calculation: document.calculation,
  issue_eligible: document.issue_eligible,
  validation_issues: document.validation_issues,
  financially_edited: document.financially_edited,
  source_payload_hash: document.source_payload_hash,
  edited_by: document.edited_by,
  edited_at: document.edited_at,
  reviewed_by: document.reviewed_by,
  reviewed_at: document.reviewed_at,
  review_note: document.review_note,
  rejected_by: document.rejected_by,
  rejected_at: document.rejected_at,
  created_at: document.updated_at ?? document.created_at,
});

export const invoiceDocumentRepository = {
  async ensureInitialDraft(
    sourceOrderDocumentId: string,
    expectedSourcePayloadHash: string,
    value: Record<string, unknown>,
  ): Promise<{ created: boolean; document: Record<string, unknown> }> {
    const documentRef = documents.doc(sourceOrderDocumentId);
    const sourceRef = sourceOrders.doc(sourceOrderDocumentId);
    return db.runTransaction(async (transaction) => {
      const [sourceSnapshot, documentSnapshot] = await Promise.all([
        transaction.get(sourceRef),
        transaction.get(documentRef),
      ]);
      const source = sourceSnapshot.exists
        ? (sourceSnapshot.data() as Record<string, unknown>)
        : undefined;
      if (
        !source ||
        source.is_deleted === true ||
        source.source_payload_hash !== expectedSourcePayloadHash ||
        source.warehouse_id !== value.warehouse_id
      ) {
        throw serviceError(
          409,
          "Đơn hàng nguồn đã thay đổi trong khi tạo bản nháp.",
          "生成草稿时源订单已更改。",
          "INVOICE_SOURCE_STALE",
        );
      }
      if (documentSnapshot.exists) {
        const current = documentSnapshot.data() as Record<string, unknown>;
        assertScopedDocument(current, String(value.warehouse_id));
        if (
          source.invoice_document_id !== documentRef.id ||
          source.invoice_document_status !== current.status
        ) {
          transaction.update(sourceRef, {
            invoice_document_id: documentRef.id,
            invoice_document_status: current.status,
            updated_at: new Date(),
          });
        }
        return { created: false, document: current };
      }

      transaction.create(documentRef, value);
      transaction.create(
        documentRef.collection("revisions").doc(String(value.revision)),
        revisionSnapshot(value),
      );
      transaction.update(sourceRef, {
        invoice_document_id: documentRef.id,
        invoice_document_status: value.status,
        updated_at: new Date(),
      });
      return { created: true, document: value };
    });
  },

  async getDocument(id: string, warehouseId: string) {
    const snapshot = await documents.doc(id).get();
    if (!snapshot.exists) return null;
    const value = snapshot.data() as Record<string, unknown>;
    return value.warehouse_id === warehouseId && value.is_deleted !== true
      ? value
      : null;
  },

  async listRevisions(id: string, warehouseId: string, limit = 20) {
    const document = await this.getDocument(id, warehouseId);
    if (!document) return null;
    const snapshot = await documents
      .doc(id)
      .collection("revisions")
      .orderBy("revision", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((item) => item.data());
  },

  async updateDraft(
    id: string,
    warehouseId: string,
    expectedRevision: number,
    expectedSourcePayloadHash: string,
    nextValue: Record<string, unknown>,
  ) {
    const documentRef = documents.doc(id);
    const sourceRef = sourceOrders.doc(id);
    return db.runTransaction(async (transaction) => {
      const [documentSnapshot, sourceSnapshot] = await Promise.all([
        transaction.get(documentRef),
        transaction.get(sourceRef),
      ]);
      const current = documentSnapshot.exists
        ? (documentSnapshot.data() as Record<string, unknown>)
        : undefined;
      assertScopedDocument(current, warehouseId);
      assertRevision(current!, expectedRevision);
      assertSourceFresh(
        sourceSnapshot.exists
          ? (sourceSnapshot.data() as Record<string, unknown>)
          : undefined,
        current!,
        expectedSourcePayloadHash,
      );
      const next = { ...current, ...nextValue };
      transaction.update(documentRef, nextValue);
      transaction.update(sourceRef, {
        invoice_document_status: next.status,
        updated_at: next.updated_at,
      });
      transaction.create(
        documentRef.collection("revisions").doc(String(next.revision)),
        revisionSnapshot(next),
      );
      return next;
    });
  },

  async rebaseDraft(
    id: string,
    warehouseId: string,
    expectedRevision: number,
    expectedStatus: string,
    nextSourcePayloadHash: string,
    nextValue: Record<string, unknown>,
  ) {
    const documentRef = documents.doc(id);
    const sourceRef = sourceOrders.doc(id);
    return db.runTransaction(async (transaction) => {
      const [documentSnapshot, sourceSnapshot] = await Promise.all([
        transaction.get(documentRef),
        transaction.get(sourceRef),
      ]);
      const current = documentSnapshot.exists
        ? (documentSnapshot.data() as Record<string, unknown>)
        : undefined;
      const source = sourceSnapshot.exists
        ? (sourceSnapshot.data() as Record<string, unknown>)
        : undefined;
      assertScopedDocument(current, warehouseId);
      assertRevision(current!, expectedRevision);
      if (current!.status !== expectedStatus) {
        throw serviceError(
          409,
          "Trạng thái bản nháp đã thay đổi. Vui lòng tải lại.",
          "草稿状态已更改，请重新加载。",
          "INVOICE_STATUS_CONFLICT",
        );
      }
      if (
        !source ||
        source.is_deleted === true ||
        source.warehouse_id !== warehouseId ||
        source.source_payload_hash !== nextSourcePayloadHash
      ) {
        throw serviceError(
          409,
          "Đơn hàng nguồn tiếp tục thay đổi. Vui lòng đồng bộ lại.",
          "源订单再次更改，请重新同步。",
          "INVOICE_SOURCE_STALE",
        );
      }
      const next = { ...current, ...nextValue };
      transaction.update(documentRef, nextValue);
      transaction.create(
        documentRef.collection("revisions").doc(String(next.revision)),
        revisionSnapshot(next),
      );
      transaction.update(sourceRef, {
        invoice_document_id: id,
        invoice_document_status: next.status,
        updated_at: next.updated_at,
      });
      return next;
    });
  },

  async recordPreparedPayload(
    id: string,
    warehouseId: string,
    expectedRevision: number,
    expectedSourcePayloadHash: string,
    value: Record<string, unknown>,
  ) {
    const documentRef = documents.doc(id);
    const sourceRef = sourceOrders.doc(id);
    return db.runTransaction(async (transaction) => {
      const [documentSnapshot, sourceSnapshot] = await Promise.all([
        transaction.get(documentRef),
        transaction.get(sourceRef),
      ]);
      const current = documentSnapshot.exists
        ? (documentSnapshot.data() as Record<string, unknown>)
        : undefined;
      assertScopedDocument(current, warehouseId);
      assertRevision(current!, expectedRevision);
      assertSourceFresh(
        sourceSnapshot.exists
          ? (sourceSnapshot.data() as Record<string, unknown>)
          : undefined,
        current!,
        expectedSourcePayloadHash,
      );
      transaction.update(documentRef, value);
      return { ...current, ...value };
    });
  },
};
