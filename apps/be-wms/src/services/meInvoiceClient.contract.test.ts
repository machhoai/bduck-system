import assert from "node:assert/strict";
import test from "node:test";
import { MeInvoiceClient } from "./meInvoiceClient.js";

const credentials = {
  clientSecret: process.env.MEINVOICE_SANDBOX_CLIENT_SECRET ?? "",
  taxCode: process.env.MEINVOICE_SANDBOX_TAX_CODE ?? "",
  username: process.env.MEINVOICE_SANDBOX_USERNAME ?? "",
  password: process.env.MEINVOICE_SANDBOX_PASSWORD ?? "",
};
const hasSandboxCredentials = Object.values(credentials).every(Boolean);
const clientId = process.env.MEINVOICE_SANDBOX_CLIENT_ID ?? "";
const hasCompleteSandboxCredentials = hasSandboxCredentials && Boolean(clientId);

test(
  "MISA sandbox token and template contract",
  { skip: !hasCompleteSandboxCredentials },
  async () => {
    const client = new MeInvoiceClient(
      "https://developer.misa.vn/apis/itg/meinvoice",
      clientId,
    );
    const token = await client.getToken(credentials);
    assert.ok(token.length > 0);

    const [withCode, withoutCode] = await Promise.all([
      client.listTemplates(token, true),
      client.listTemplates(token, false),
    ]);
    assert.ok(Array.isArray(withCode));
    assert.ok(Array.isArray(withoutCode));
  },
);
