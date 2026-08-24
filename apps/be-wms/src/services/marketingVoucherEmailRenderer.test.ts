import assert from "node:assert/strict";
import test from "node:test";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";

import { renderMarketingVoucherEmail } from "./marketingVoucherEmailRenderer.js";

const campaign = {
  id: "campaign-a",
  name: "Summer <script>alert(1)</script>",
  description: "Use & enjoy",
  accent_color: "#F97316",
} as MarketingVoucherCampaign;

const code = (id: string) =>
  ({
    id,
    reward_type: "DISCOUNT_PERCENT",
    reward_value: 20,
    valid_to: "2026-12-31",
  }) as MarketingVoucherCode;

test("voucher email renderer escapes content and embeds one QR per code", async () => {
  const rendered = await renderMarketingVoucherEmail({
    campaign,
    codes: [code("CODE-A"), code("CODE-B")],
    introduction: "Hello <img src=x>\nSecond line",
  });

  assert.equal(rendered.attachments.length, 2);
  assert.ok(rendered.htmlContent.includes("Hello &lt;img src=x&gt;<br />"));
  assert.ok(rendered.htmlContent.includes("Summer &lt;script&gt;"));
  assert.ok(!rendered.htmlContent.includes("<script>"));
  for (const attachment of rendered.attachments) {
    assert.equal(attachment.contentType, "image/png");
    assert.equal(attachment.contentDisposition, "inline");
    assert.ok(attachment.cid);
    assert.ok(attachment.content.length > 100);
    assert.ok(rendered.htmlContent.includes(`cid:${attachment.cid}`));
  }
});
