import { createHash } from "node:crypto";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
} from "@bduck/shared-types";
import QRCode from "qrcode";

import type { BrevoEmailAttachment } from "./brevoEmailService.js";

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
  if (code.reward_type === "DISCOUNT_PERCENT") return `${code.reward_value}%`;
  if (code.reward_type === "DISCOUNT_FIXED") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(code.reward_value);
  }
  return code.reward_type === "FREE_TICKET" ? "VÉ MIỄN PHÍ" : "QUÀ TẶNG";
};

const voucherCid = (codeId: string) =>
  `voucher-${createHash("sha256").update(codeId).digest("hex").slice(0, 20)}@jpulse`;

const voucherCard = (
  campaign: MarketingVoucherCampaign,
  code: MarketingVoucherCode,
  cid: string,
) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;background:#ffffff">
    <tr><td style="height:12px;background:${safeAccent(campaign.accent_color)}"></td></tr>
    <tr>
      <td style="padding:24px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:top;padding-right:16px">
              <div style="font:800 12px Arial,sans-serif;letter-spacing:2px;color:#64748b">JPULSE · B.DUCK</div>
              <h2 style="margin:10px 0 4px;font:800 22px Arial,sans-serif;color:#0f172a">${escapeHtml(campaign.name)}</h2>
              <p style="margin:0 0 18px;font:14px/1.5 Arial,sans-serif;color:#64748b">${escapeHtml(campaign.description)}</p>
              <div style="font:900 28px Arial,sans-serif;color:#0f172a">${escapeHtml(rewardLabel(code))}</div>
              <div style="margin-top:16px;font:700 18px 'Courier New',monospace;letter-spacing:1px;color:#0f172a">${escapeHtml(code.id)}</div>
              <div style="margin-top:8px;font:12px Arial,sans-serif;color:#64748b">Valid until · ${escapeHtml(code.valid_to)}</div>
            </td>
            <td width="132" style="vertical-align:top;text-align:right">
              <img src="cid:${cid}" width="120" height="120" alt="QR ${escapeHtml(code.id)}" style="display:block;width:120px;height:120px;border:6px solid #ffffff" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

export interface RenderMarketingVoucherEmailInput {
  campaign: MarketingVoucherCampaign;
  codes: MarketingVoucherCode[];
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
  const introductionHtml = escapeHtml(input.introduction).replaceAll(
    "\n",
    "<br />",
  );
  const cards = input.codes
    .map((code) => voucherCard(input.campaign, code, voucherCid(code.id)))
    .join("");
  return {
    htmlContent: `<!doctype html><html><body style="margin:0;background:#f8fafc"><div style="max-width:680px;margin:0 auto;padding:32px 16px"><div style="font:15px/1.7 Arial,sans-serif;color:#334155">${introductionHtml}</div>${cards}</div></body></html>`,
    textContent: [
      input.introduction,
      ...input.codes.map(
        (code) =>
          `${input.campaign.name} — ${rewardLabel(code)} — ${code.id} — ${code.valid_to}`,
      ),
    ].join("\n\n"),
    attachments,
  };
};
