export interface InvoiceStatusBatchCandidate<T = unknown> {
  account_id: string;
  invoice_with_code: boolean;
  invoice_calculating_machine: boolean;
  ref_id: string;
  context: T;
}

export interface InvoiceStatusBatch<T = unknown> {
  account_id: string;
  invoice_with_code: boolean;
  invoice_calculating_machine: boolean;
  items: InvoiceStatusBatchCandidate<T>[];
}

export const planInvoiceStatusBatches = <T>(
  candidates: InvoiceStatusBatchCandidate<T>[],
  batchSize = 30,
): InvoiceStatusBatch<T>[] => {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 30) {
    throw new Error("MEINVOICE_STATUS_BATCH_SIZE_INVALID");
  }
  const groups = new Map<string, InvoiceStatusBatchCandidate<T>[]>();
  for (const candidate of candidates) {
    const key = JSON.stringify([
      candidate.account_id,
      candidate.invoice_with_code,
      candidate.invoice_calculating_machine,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  const batches: InvoiceStatusBatch<T>[] = [];
  for (const items of groups.values()) {
    for (let cursor = 0; cursor < items.length; cursor += batchSize) {
      const chunk = items.slice(cursor, cursor + batchSize);
      batches.push({
        account_id: chunk[0]!.account_id,
        invoice_with_code: chunk[0]!.invoice_with_code,
        invoice_calculating_machine: chunk[0]!.invoice_calculating_machine,
        items: chunk,
      });
    }
  }
  return batches;
};
