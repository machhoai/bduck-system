import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeInvoiceDisplayMappingDraft,
  withInvoiceDisplayMappingDraftValue,
} from "./invoiceDisplayMappingDraft.js";

test("invoice display mapping keeps spaces while the user is typing", () => {
  const source = "Vé khu vui chơi";
  const afterSpace = withInvoiceDisplayMappingDraftValue(
    { [source]: "Vé khu" },
    source,
    "Vé khu ",
  );
  const afterNextWord = withInvoiceDisplayMappingDraftValue(
    afterSpace,
    source,
    "Vé khu vui",
  );

  assert.equal(afterSpace[source], "Vé khu ");
  assert.equal(afterNextWord[source], "Vé khu vui");
});

test("invoice display mapping trims only when preparing the save payload", () => {
  assert.deepEqual(
    normalizeInvoiceDisplayMappingDraft({
      product: "  Vé khu vui chơi  ",
      unit: "  Lượt  ",
      empty: "   ",
    }),
    {
      product: "Vé khu vui chơi",
      unit: "Lượt",
    },
  );
});
