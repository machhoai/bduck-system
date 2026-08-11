"use client";

import { QRCodeSVG } from "qrcode.react";

import type { PosTicketSettingsPayload } from "@/api/posManagementApi";

import { usePosTicketEditorCopy } from "./usePosTicketEditorCopy";

const printableWidth = { POS58: 58, POS80: 80, POS82: 82 } as const;
const formatCurrency = (amount: number) =>
  `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ`;

export function PosTicketPreview({ form }: { form: PosTicketSettingsPayload }) {
  const { copy } = usePosTicketEditorCopy();
  const ticket = {
    ticketCode: "JT-7F2C9A406D58445BA7F1A81A74218E35",
    goodsName: "Gian hàng trò chơi: Vịt ném bóng",
    price: 120000,
    orderId: "ORD-1786420800000-PREVIEW",
    issuedAt: "2026-08-11T10:00:00.000+07:00",
    sequence: 1,
    totalForItem: 1,
  };
  const issuedAt = new Date(ticket.issuedAt).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <aside className="rounded-xl border border-slate-200 bg-[#e9e8e5] p-4 xl:sticky xl:top-3">
      <div className="mb-3">
        <h3 className="text-sm font-black text-slate-900">{copy.preview}</h3>
        <p className="text-[11px] text-slate-500">
          {form.paper_size.replace("POS", "")} mm
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-[#d8d6d1] p-4 shadow-inner">
        <div className="mx-auto w-fit overflow-hidden bg-white shadow-xl">
          <article
            data-ticket-page
            style={{
              width: `${printableWidth[form.paper_size]}mm`,
              height: `${form.ticket_height_mm}mm`,
              overflow: "hidden",
              padding: "2mm",
              background: "#fff",
              color: "#000",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: `${form.body_font_size_pt}pt`,
              lineHeight: 1.0,
              display: "flex",
              flexDirection: "column",
              textAlign: "center",
              pageBreakAfter: "always",
              breakAfter: "page",
            }}
          >
            <header
              style={{
                borderBottom: "1px dashed #000",
                paddingBottom: "2.5mm",
              }}
            >
              {form.show_logo && form.logo_data_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_data_url}
                  alt=""
                  style={{
                    display: "block",
                    width: `${form.logo_width_mm}mm`,
                    maxHeight: `${form.logo_max_height_mm}mm`,
                    objectFit: "contain",
                    margin: "0 auto 1.5mm",
                    filter: `grayscale(1) contrast(${form.logo_contrast_percent}%)`,
                  }}
                />
              ) : null}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: `${form.title_font_size_pt}pt`,
                  letterSpacing: "0.5px",
                }}
              >
                {form.ticket_title}
              </div>
              <div style={{ marginTop: "1mm", fontWeight: 700 }}>
                {form.store_name}
              </div>
              {form.subtitle ? (
                <div style={{ marginTop: "1mm" }}>{form.subtitle}</div>
              ) : null}
            </header>
            <main
              style={{
                display: "flex",
                minHeight: 0,
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5mm 0",
              }}
            >
              <div
                style={{
                  fontSize: `${form.product_font_size_pt}pt`,
                  fontWeight: form.font_weight,
                  lineHeight: 1.2,
                }}
              >
                {ticket.goodsName}
              </div>
              {form.show_sequence && ticket.totalForItem > 1 ? (
                <div style={{ marginTop: "1mm", fontWeight: 700 }}>
                  Vé {ticket.sequence}/{ticket.totalForItem}
                </div>
              ) : null}
              {form.show_price ? (
                <div style={{ marginTop: "1mm" }}>
                  {formatCurrency(ticket.price)}
                </div>
              ) : null}
              <div style={{ margin: "2mm 0 1mm" }}>
                <QRCodeSVG
                  value={ticket.ticketCode}
                  size={256}
                  level="M"
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  title={`Mã vé ${ticket.ticketCode}`}
                  style={{
                    width: `${form.qr_size_mm}mm`,
                    height: `${form.qr_size_mm}mm`,
                  }}
                />
              </div>
              <div
                style={{
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  fontFamily: "monospace",
                  fontSize: `${Math.max(6, form.body_font_size_pt - 1)}pt`,
                  fontWeight: 700,
                }}
              >
                {ticket.ticketCode}
              </div>
            </main>
            <footer style={{ borderTop: "1px dashed #000", paddingTop: "2mm" }}>
              <div style={{ display: "grid", gap: "0.5mm", textAlign: "left" }}>
                {form.show_order_code ? (
                  <div>
                    <strong>Mã đơn:</strong> {ticket.orderId}
                  </div>
                ) : null}
                {form.show_issued_at ? (
                  <div>
                    <strong>Phát hành:</strong> {issuedAt}
                  </div>
                ) : null}
              </div>
              {form.instructions ? (
                <div style={{ marginTop: "1.5mm" }}>{form.instructions}</div>
              ) : null}
              {form.footer_message ? (
                <div style={{ marginTop: "1.5mm", fontWeight: 700 }}>
                  {form.footer_message}
                </div>
              ) : null}
            </footer>
          </article>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
        {copy.previewHint}
      </p>
    </aside>
  );
}
