import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceDocumentStatus,
  MeInvoiceEnvironment,
  MeInvoiceSignType,
  canTransitionInvoiceDocument,
} from "@bduck/shared-types";
import { createMeInvoiceCredentialCrypto } from "./meInvoiceCredentialCrypto.js";
import { MeInvoiceApiError, MeInvoiceClient } from "./meInvoiceClient.js";
import {
  meInvoiceAccountInputSchema,
  meInvoiceStoreConfigInputSchema,
} from "./meInvoiceConfigSchemas.js";

test("invoice state machine permits only declared transitions", () => {
  assert.equal(
    canTransitionInvoiceDocument(
      InvoiceDocumentStatus.READY_TO_ISSUE,
      InvoiceDocumentStatus.QUEUED,
    ),
    true,
  );
  assert.equal(
    canTransitionInvoiceDocument(
      InvoiceDocumentStatus.NEEDS_REVIEW,
      InvoiceDocumentStatus.ISSUED,
    ),
    false,
  );
});

test("meInvoice credential encryption binds ciphertext to its context", () => {
  const crypto = createMeInvoiceCredentialCrypto("unit-test-key");
  const encrypted = crypto.encrypt("secret-value", "account:1:password");
  assert.equal(crypto.decrypt(encrypted, "account:1:password"), "secret-value");
  assert.throws(() => crypto.decrypt(encrypted, "account:2:password"));
});

test("account schema accepts supported MISA environments", () => {
  const value = meInvoiceAccountInputSchema.parse({
    legal_entity_id: "legal-entity-1",
    display_name: "MISA Sandbox",
    tax_code: "0101243150",
    environment: MeInvoiceEnvironment.SANDBOX,
    client_id: "client-id",
    client_secret: "client-secret",
    username: "user",
    password: "password",
  });
  assert.equal(value.enabled, false);
});

test("enabled store config requires an explicit VAT-inclusive decision", () => {
  const result = meInvoiceStoreConfigInputSchema.safeParse({
    meinvoice_account_id: "account-1",
    inv_series: "1C25MYY",
    invoice_with_code: true,
    sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
    seller_shop_code: "SHOP-1",
    seller_shop_name: "Shop 1",
    price_includes_vat: null,
    tax_rate_source: "SOURCE",
    enabled: true,
  });
  assert.equal(result.success, false);
});

test("store config defaults the anonymous retail buyer and payment invoice date", () => {
  const value = meInvoiceStoreConfigInputSchema.parse({
    meinvoice_account_id: "account-1",
    inv_series: "1C25MYY",
    invoice_with_code: true,
    sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
    seller_shop_code: "SHOP-1",
    seller_shop_name: "Shop 1",
    price_includes_vat: true,
    tax_rate_source: "SOURCE",
  });
  assert.equal(value.default_buyer_name, "Khách lẻ (Không lấy hóa đơn)");
  assert.equal(value.default_buyer_tax_code, null);
  assert.equal(value.go_live_at, null);
});

test("store config may be enabled before the rollout timestamp is selected", () => {
  const result = meInvoiceStoreConfigInputSchema.safeParse({
    meinvoice_account_id: "account-1",
    inv_series: "1C25MYY",
    invoice_with_code: true,
    sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
    seller_shop_code: "SHOP-1",
    seller_shop_name: "Shop 1",
    tax_rate_source: "SOURCE",
    enabled: true,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.price_includes_vat, true);
    assert.equal(result.data.default_buyer_address, "");
    assert.equal(result.data.go_live_at, null);
  }
});

test("store config accepts only MISA VATRateName values", () => {
  const storeConfig = {
    meinvoice_account_id: "account-1",
    inv_series: "1C25MYY",
    invoice_with_code: true,
    sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
    seller_shop_code: "SHOP-1",
    seller_shop_name: "Shop 1",
    price_includes_vat: true,
    tax_rate_source: "SOURCE" as const,
  };
  const valid = meInvoiceStoreConfigInputSchema.safeParse({
    ...storeConfig,
    default_vat_rate_name: "10%",
  });
  const invalid = meInvoiceStoreConfigInputSchema.safeParse({
    ...storeConfig,
    default_vat_rate_name: "10",
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});

test("MeInvoiceClient sends the documented token contract", async () => {
  let requestedUrl = "";
  let requestedBody = "";
  let requestedHeaders: RequestInit["headers"];
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async (input, init) => {
      requestedUrl = String(input);
      requestedBody = String(init?.body);
      requestedHeaders = init?.headers;
      return new Response(
        JSON.stringify({ Success: true, Data: "token-value" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch,
  );

  const token = await client.getToken({
    clientSecret: "client-secret",
    taxCode: "0101243150",
    username: "user",
    password: "pass",
  });
  assert.equal(token, "token-value");
  assert.match(requestedUrl, /\/invoice\/token$/);
  assert.deepEqual(JSON.parse(requestedBody), {
    taxcode: "0101243150",
    username: "user",
    password: "pass",
  });
  const headers = new Headers(requestedHeaders);
  assert.equal(headers.get("ClientID"), "client-id");
  assert.equal(headers.get("ClientSecret"), "client-secret");
});

test("MeInvoiceClient normalizes template data returned as JSON text", async () => {
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: JSON.stringify([
            {
              IPTemplateID: "template-1",
              TemplateName: "VAT invoice",
              InvTemplateNo: "1",
              InvSeries: "1C25MYY",
              Inactive: false,
              IsSendSummary: false,
              IsMoreVATRate: true,
            },
          ]),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );

  const templates = await client.listTemplates("token", true);
  assert.equal(templates.length, 1);
  assert.equal(templates[0]?.inv_series, "1C25MYY");
  assert.equal(templates[0]?.is_more_vat_rate, true);
});

test("MeInvoiceClient treats an empty template response as an empty list", async () => {
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async () =>
      new Response(JSON.stringify({ success: true, data: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  );

  assert.deepEqual(await client.listTemplates("token", false), []);
});

test("MeInvoiceClient rejects unsuccessful MISA envelopes", async () => {
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async () =>
      new Response(
        JSON.stringify({ Success: false, ErrorCode: "InvalidTokenCode" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );
  await assert.rejects(
    () => client.listTemplates("bad-token", true),
    (error: unknown) =>
      error instanceof MeInvoiceApiError && error.code === "InvalidTokenCode",
  );
});

test("MeInvoiceClient uses the documented paging contract", async () => {
  let requestedPagingUrl = "";
  let requestedPagingBody = "";
  let requestedPagingHeaders: RequestInit["headers"];
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async (input, init) => {
      requestedPagingUrl = String(input);
      requestedPagingBody = String(init?.body);
      requestedPagingHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          success: true,
          data: { Total: 1, Items: [{ RefID: "ref-1" }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
  );
  const result = await client.pageInvoices("token", true, {
    fromDate: "2026-07-19",
    toDate: "2026-07-19",
    skip: 0,
    take: 100,
  });
  assert.equal(result.total, 1);
  assert.match(requestedPagingUrl, /\/invoice\/paging\?invoiceWithCode=true$/);
  assert.deepEqual(JSON.parse(requestedPagingBody), {
    FromDate: "2026-07-19",
    ToDate: "2026-07-19",
    Skip: 0,
    Take: 100,
    ListInvTemplate: [],
  });
  const headers = new Headers(requestedPagingHeaders);
  assert.equal(headers.get("ClientID"), "client-id");
  assert.equal(headers.get("ClientSecret"), null);
});

test("MeInvoiceClient normalizes production paging PageData JSON text", async () => {
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    (async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: JSON.stringify({
            TotalCount: 1,
            PageData: JSON.stringify([{ RefID: "ref-production" }]),
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
  );

  const result = await client.pageInvoices("token", true, {
    fromDate: "2026-07-19",
    toDate: "2026-07-19",
    skip: 0,
    take: 100,
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.RefID, "ref-production");
});
