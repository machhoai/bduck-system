import { createHash } from "node:crypto";

type SourceOrderIdentityWrite = {
  source_order_id: string;
  projection: Record<string, unknown>;
};

export type InvoiceSourceSystemIdentity = "JOYWORLD" | "JPOS";

export const sourceSystemForWrite = (
  value: SourceOrderIdentityWrite,
): InvoiceSourceSystemIdentity =>
  value.projection.source_system === "JPOS" ? "JPOS" : "JOYWORLD";

export const invoiceSourceOrderDocumentId = (
  warehouseId: string,
  sourceOrderId: string,
  sourceSystem: InvoiceSourceSystemIdentity = "JOYWORLD",
) =>
  createHash("sha256")
    .update(`${warehouseId}:${sourceSystem}:${sourceOrderId}`)
    .digest("hex");

export const deduplicateSourceOrderWrites = <
  T extends SourceOrderIdentityWrite,
>(
  values: T[],
): T[] => {
  const unique = new Map<string, T>();
  for (const value of values) {
    unique.set(
      `${sourceSystemForWrite(value)}\u0000${value.source_order_id}`,
      value,
    );
  }
  return [...unique.values()];
};
