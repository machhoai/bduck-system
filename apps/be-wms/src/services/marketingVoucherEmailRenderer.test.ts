import assert from "node:assert/strict";
import test from "node:test";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";

import { applyBrevoEmailSignature } from "./brevoEmailSignature.js";
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
    subject: "Gift <script>alert(2)</script>",
    introduction: "Hello <img src=x>\nSecond line",
  });

  assert.equal(rendered.attachments.length, 2);
  assert.ok(rendered.htmlContent.includes("Hello &lt;img src=x&gt;<br />"));
  assert.ok(rendered.htmlContent.includes("Summer &lt;script&gt;"));
  assert.ok(rendered.htmlContent.includes("<title>Gift &lt;script&gt;"));
  assert.ok(rendered.htmlContent.includes(">Gift &lt;script&gt;alert(2)&lt;/script&gt;</h1>"));
  assert.ok(!rendered.htmlContent.includes("<script>"));
  for (const attachment of rendered.attachments) {
    assert.equal(attachment.contentType, "image/png");
    assert.equal(attachment.contentDisposition, "inline");
    assert.ok(attachment.cid);
    assert.ok(attachment.content.length > 100);
    assert.ok(rendered.htmlContent.includes(`cid:${attachment.cid}`));
  }
  assert.ok(rendered.htmlContent.includes("Hạn sử dụng: <strong"));
  assert.ok(rendered.htmlContent.includes("31/12/2026"));
  assert.ok(rendered.htmlContent.includes('width="170" height="170"'));
  assert.ok(rendered.htmlContent.includes("border-left:2px dashed"));
});

test("voucher email places configured signature inside its footer", async () => {
  const rendered = await renderMarketingVoucherEmail({
    campaign,
    codes: [code("CODE-A")],
    subject: "Voucher của bạn",
    introduction: "Xin chào",
  });
  const signature = "<table><tr><td>Chữ ký từ env</td></tr></table>";
  const finalContent = applyBrevoEmailSignature(
    rendered.htmlContent,
    rendered.textContent,
    signature,
    "\nChữ ký từ env",
  );

  assert.ok(finalContent.htmlContent.includes(signature));
  assert.ok(finalContent.htmlContent.indexOf(signature) < finalContent.htmlContent.indexOf("</body>"));
  assert.ok(!finalContent.htmlContent.includes("BREVO_EMAIL_SIGNATURE"));
  assert.ok(finalContent.textContent.endsWith("Chữ ký từ env"));
});
