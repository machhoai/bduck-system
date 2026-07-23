import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route.js";

test("service worker caches static assets but never authenticated page responses", async () => {
  const response = GET();
  const source = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Service-Worker-Allowed"), "/");
  assert.match(source, /navigationWithOfflineFallback/);
  assert.match(source, /return await fetch\(request\)/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(source, /AbortController/);
  assert.doesNotMatch(source, /controller\.abort/);
  assert.doesNotMatch(source, /3000/);
  assert.doesNotMatch(source, /PAGE_CACHE/);
});
