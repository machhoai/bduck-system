import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFacilityRelationship,
  assertLocationRelationship,
} from "./facilityRelationshipPolicy.js";

test("accepts resources that belong to the declared facility and location", () => {
  assert.doesNotThrow(() =>
    assertFacilityRelationship("facility-a", "facility-a", "facility-a"),
  );
  assert.doesNotThrow(() =>
    assertLocationRelationship("location-a", "location-a"),
  );
});

test("rejects spoofed, empty, or cross-facility relationships", () => {
  for (const run of [
    () => assertFacilityRelationship("facility-a", "facility-b"),
    () => assertFacilityRelationship("", ""),
    () => assertFacilityRelationship("facility-a"),
    () => assertLocationRelationship("location-a", "location-b"),
  ]) {
    assert.throws(run, (error: unknown) => {
      const apiError = error as {
        statusCode: number;
        code: string;
        messages: { vi: string; zh: string };
      };
      assert.equal(apiError.statusCode, 400);
      assert.equal(apiError.code, "FACILITY_RELATIONSHIP_MISMATCH");
      assert.ok(apiError.messages.vi.length > 0);
      assert.ok(apiError.messages.zh.length > 0);
      return true;
    });
  }
});
