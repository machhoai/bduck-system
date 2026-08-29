import assert from "node:assert/strict";
import test from "node:test";

import { isMissingFirestoreIndexError } from "./firestoreQueryError.js";

test("recognizes Firestore missing composite index errors", () => {
  assert.equal(
    isMissingFirestoreIndexError({
      code: 9,
      details: "The query requires an index.",
    }),
    true,
  );
  assert.equal(
    isMissingFirestoreIndexError({
      code: "9",
      message: "FAILED_PRECONDITION: create the required index",
    }),
    true,
  );
});

test("does not hide unrelated Firestore failures", () => {
  assert.equal(isMissingFirestoreIndexError({ code: 7 }), false);
  assert.equal(isMissingFirestoreIndexError(new Error("network unavailable")), false);
  assert.equal(isMissingFirestoreIndexError(null), false);
});
