import { createHash } from "node:crypto";

export const invoiceGlobalSourceIdentityDocumentId = (
  sourceAccountKey: string,
  externalOrderNumber: string,
) =>
  createHash("sha256")
    .update(`${sourceAccountKey}:${externalOrderNumber}`)
    .digest("hex");
