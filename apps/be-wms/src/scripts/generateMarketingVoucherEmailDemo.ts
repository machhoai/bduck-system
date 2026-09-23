import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";

import { applyBrevoEmailSignature } from "../services/brevoEmailSignature.js";
import { renderMarketingVoucherEmail } from "../services/marketingVoucherEmailRenderer.js";

const campaign = {
  name: "Ngày vui cùng B.Duck",
  description: "Một ưu đãi nhỏ để hành trình vui chơi của bạn thêm đáng nhớ.",
  accent_color: "#F5C542",
} as MarketingVoucherCampaign;

const code = {
  id: "BDUCK-8K42M7",
  reward_type: "DISCOUNT_PERCENT",
  reward_value: 20,
  valid_to: "2026-12-31",
} as MarketingVoucherCode;

const rendered = await renderMarketingVoucherEmail({
  campaign,
  codes: [code],
  subject: "Quà tặng B.Duck dành riêng cho bạn",
  introduction:
    "Xin chào bạn,\nCảm ơn bạn đã đồng hành cùng B.Duck. Chúng tôi gửi tặng bạn voucher dưới đây như một lời chúc cho những khoảnh khắc thật vui!",
});

if (!process.env.BREVO_EMAIL_SIGNATURE_HTML) {
  throw new Error("BREVO_EMAIL_SIGNATURE_HTML is required for the demo");
}

const finalContent = applyBrevoEmailSignature(
  rendered.htmlContent,
  rendered.textContent,
  process.env.BREVO_EMAIL_SIGNATURE_HTML ?? "",
  process.env.BREVO_EMAIL_SIGNATURE_TEXT ?? "",
);

let html = finalContent.htmlContent;
for (const attachment of rendered.attachments) {
  html = html.replaceAll(
    `cid:${attachment.cid}`,
    `data:${attachment.contentType};base64,${attachment.content.toString("base64")}`,
  );
}

const outputPath = resolve(process.argv[2] ?? "../../outputs/voucher-email-demo.html");
await writeFile(outputPath, html, "utf8");
