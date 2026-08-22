import { createHash } from "node:crypto";

import type { SourceOrderWrite } from "../repositories/invoiceOrderRepository.js";

const documentIdForWrite = (warehouseId: string, write: SourceOrderWrite) => {
  const sourceSystem =
    write.projection.source_system === "JPOS" ? "JPOS" : "JOYWORLD";
  return createHash("sha256")
    .update(`${warehouseId}:${sourceSystem}:${write.source_order_id}`)
    .digest("hex");
};

/**
 * JPOS is ingested first for local-only resilience. An HKAPI-enriched write for
 * the same document must win before any draft is created or rebased.
 */
export const finalInvoiceSourceWrites = (
  warehouseId: string,
  posWrites: SourceOrderWrite[],
  hkapiWrites: SourceOrderWrite[],
): SourceOrderWrite[] => {
  const finalByDocumentId = new Map<string, SourceOrderWrite>();
  for (const write of posWrites) {
    finalByDocumentId.set(documentIdForWrite(warehouseId, write), write);
  }
  for (const write of hkapiWrites) {
    finalByDocumentId.set(documentIdForWrite(warehouseId, write), write);
  }
  return [...finalByDocumentId.values()];
};
