import assert from "node:assert/strict";
import test from "node:test";

import { invoiceErrorToast } from "./invoiceErrorPresentation.js";

test("invoice errors include cause, recovery and technical code", () => {
  const result = invoiceErrorToast(
    Object.assign(new Error("MISA giới hạn tần suất"), {
      statusCode: 429,
      code: "MISA_RATE_LIMIT",
    }),
    "UPDATE",
    "Không thể cập nhật",
  );
  assert.match(result.title, /Cập nhật/);
  assert.match(result.description, /Nguyên nhân:/);
  assert.match(result.description, /Cách xử lý:/);
  assert.match(result.description, /MISA_RATE_LIMIT · HTTP 429/);
});
