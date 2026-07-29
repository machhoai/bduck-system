import assert from "node:assert/strict";
import test from "node:test";
import { employeeContractTranslations } from "./employeeContractTranslations.js";

test("keeps the Vietnamese and Chinese contract dictionaries aligned", () => {
  const vi = employeeContractTranslations.vi;
  const zh = employeeContractTranslations.zh;
  assert.deepEqual(Object.keys(zh), Object.keys(vi));
  assert.deepEqual(Object.keys(zh.toasts), Object.keys(vi.toasts));
  assert.deepEqual(Object.keys(zh.documents), Object.keys(vi.documents));
  assert.deepEqual(Object.keys(zh.statuses), Object.keys(vi.statuses));
});
