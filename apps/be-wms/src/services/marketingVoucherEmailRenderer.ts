import { createHash } from "node:crypto";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";
import QRCode from "qrcode";

import type { BrevoEmailAttachment } from "./brevoEmailService.js";
import { BREVO_EMAIL_SIGNATURE_SLOT } from "./brevoEmailSignature.js";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeAccent = (value: string) =>
  /^#[0-9A-F]{6}$/iu.test(value) ? value.toUpperCase() : "#F5C542";

const rewardLabel = (code: MarketingVoucherCode) => {
  if (code.reward_type === "DISCOUNT_PERCENT") return `Giảm ${code.reward_value}%`;
  if (code.reward_type === "DISCOUNT_FIXED") {
    return `Giảm ${new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(code.reward_value)}`;
  }
  return code.reward_type === "FREE_TICKET" ? "Vé miễn phí" : "Quà tặng";
};

const formatExpiry = (date: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
};

const voucherCid = (codeId: string) =>
  `voucher-${createHash("sha256").update(codeId).digest("hex").slice(0, 20)}@jpulse`;

const voucherCard = (
  campaign: MarketingVoucherCampaign,
  code: MarketingVoucherCode,
  cid: string,
) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;border-collapse:separate;border-spacing:0;border:1px solid #e7e4dc;border-radius:16px;background:#ffffff;overflow:hidden;">
    <tr><td style="height:7px;background:${safeAccent(campaign.accent_color)};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">
        <tr>
          <td class="voucher-main" width="62%" style="width:62%;vertical-align:top;padding:15px;background:#ffffff;">
            <h2 style="margin:0 0 7px;font:700 21px/1.25 Arial,Helvetica,sans-serif;color:#202b32;">${escapeHtml(campaign.name)}</h2>
            <p style="margin:0 0 10px;font:13px/1.55 Arial,Helvetica,sans-serif;color:#617078;">${escapeHtml(campaign.description)}</p>
            <p style="margin:0 0 10px;font:700 20px/1.1 Arial,Helvetica,sans-serif;color:#202b32;">${escapeHtml(rewardLabel(code))}</p>
            <div style="border-top:1px solid #e7e4dc;padding-top:15px;">
              <p style="margin:0 0 5px;font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#869199;">MÃ VOUCHER</p>
              <p style="margin:0 0 11px;font:700 17px/1.4 'Courier New',monospace;overflow-wrap:anywhere;color:#202b32;">${escapeHtml(code.id)}</p>
              <p style="margin:0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#617078;">Hạn sử dụng: <strong style="color:#202b32;">${escapeHtml(formatExpiry(code.valid_to))}</strong></p>
            </div>
          </td>
          <td class="voucher-qr" width="38%" style="width:38%;vertical-align:middle;padding:18px 15px;border-left:2px dashed #d7d4ca;background:#fff9e9;text-align:center;">
            <p style="margin:0 0 13px;font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#8a6a12;">QUÉT ĐỂ SỬ DỤNG</p>
            <img src="cid:${cid}" width="170" height="170" alt="Mã QR của voucher ${escapeHtml(code.id)}" style="display:block;width:100%;max-width:170px;height:auto;margin:0 auto;border:5px solid #ffffff;border-radius:8px;background:#ffffff;" />
            <p style="margin:13px 0 0;font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1px;color:#8a6a12;">GIỮ LẠI VÉ NÀY</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;

export interface RenderMarketingVoucherEmailInput {
  campaign: MarketingVoucherCampaign;
  codes: MarketingVoucherCode[];
  subject: string;
  introduction: string;
}

export const renderMarketingVoucherEmail = async (
  input: RenderMarketingVoucherEmailInput,
) => {
  const attachments: BrevoEmailAttachment[] = await Promise.all(
    input.codes.map(async (code) => ({
      filename: `voucher-${code.id}.png`,
      content: await QRCode.toBuffer(code.id, {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      }),
      contentType: "image/png",
      contentDisposition: "inline" as const,
      cid: voucherCid(code.id),
    })),
  );
  const introductionHtml = escapeHtml(input.introduction.trim()).replaceAll(
    "\n",
    "<br />",
  );
  const cards = input.codes
    .map((code) => voucherCard(input.campaign, code, voucherCid(code.id)))
    .join("");
  return {
    htmlContent: `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(input.subject)}</title><style>@media only screen and (max-width:480px){.voucher-main,.voucher-qr{display:block!important;width:auto!important}.voucher-qr{border-left:0!important;border-top:2px dashed #d7d4ca!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background:#f5f3ed;"><tr><td align="center" style="padding:28px 12px 40px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;table-layout:fixed;border-collapse:collapse;">
      <tr><td style="padding:15px 30px;background:#202b32;border-radius:18px 18px 0 0;">
        <h1 style="margin:0;font:700 24px/1.15 Arial,Helvetica,sans-serif;color:#ffffff;">${escapeHtml(input.subject)}</h1>
      </td></tr>
      <tr><td style="padding:20px 25px 10px;background:#fffdf8;">
        ${introductionHtml ? `<p style="margin:0 3px 25px;font:15px/1.75 Arial,Helvetica,sans-serif;white-space:normal;color:#33434b;">${introductionHtml}</p>` : ""}
        ${cards}
        <p style="margin:7px 3px 10px;font:13px/1.6 Arial,Helvetica,sans-serif;color:#617078;">Xuất trình mã voucher hoặc mã QR khi sử dụng. Vui lòng kiểm tra hạn sử dụng trên từng voucher.</p>
      </td></tr>
      <tr><td style="padding:0 28px 30px;background:#fffdf8;border-radius:0 0 18px 18px;">${BREVO_EMAIL_SIGNATURE_SLOT}</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    textContent: [
      input.subject,
      input.introduction,
      "Voucher của bạn đã sẵn sàng. Xuất trình mã hoặc QR khi sử dụng.",
      ...input.codes.map(
        (code) =>
          `${input.campaign.name} — ${rewardLabel(code)} — ${code.id} — Hạn sử dụng: ${formatExpiry(code.valid_to)}`,
      ),
    ].join("\n\n"),
    attachments,
  };
};
