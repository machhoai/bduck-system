"use client";

import type { PosLuckyDrawSettingsInput } from "@bduck/shared-types";

import { encodeCode39 } from "./posLuckyDrawBarcode";
import {
  LUCKY_DRAW_PRINTABLE_WIDTH_MM,
  LUCKY_DRAW_TICKET_HEIGHT_MM,
} from "./posLuckyDrawDefaults";

const sampleTicket = {
  orderId: "ORD-1770000000000-ABC123",
  customerName: "Nguyễn Văn An",
  customerPhone: "0901 234 567",
  purchasedAt: "26/08/2026, 10:30",
  goodsName: "Gói thành viên Bạch Kim",
  sequence: 1,
  totalForOrder: 2,
};

function OrderBarcode({ value, height }: { value: string; height: number }) {
  const barcode = encodeCode39(value);
  return (
    <svg
      role="img"
      aria-label={`Mã vạch đơn hàng ${value}`}
      viewBox={`0 0 ${barcode.width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height, paddingInline: 20 }}
    >
      <title>{`Mã vạch đơn hàng ${value}`}</title>
      <rect width={barcode.width} height={height} fill="#fff" />
      {barcode.bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${index}`}
          x={bar.x}
          width={bar.width}
          height={height}
          fill="#000"
        />
      ))}
    </svg>
  );
}

export function PosLuckyDrawPreview({
  form,
}: {
  form: PosLuckyDrawSettingsInput;
}) {
  const compact = form.paperSize === "POS58";
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: compact ? "25mm 1fr" : "30mm 1fr",
    gap: "2mm",
    alignItems: "start",
    fontSize: compact ? "8pt" : "8.5pt",
    lineHeight: 1,
  };

  return (
    <aside className="rounded-xl border border-slate-200 bg-[#e9e8e5] p-4 xl:sticky xl:top-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Xem trước phiếu</h3>
          <p className="text-[11px] text-slate-500">
            {LUCKY_DRAW_PRINTABLE_WIDTH_MM[form.paperSize]} ×{" "}
            {LUCKY_DRAW_TICKET_HEIGHT_MM} mm · Code 39
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
          Cao cố định 90 mm
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl bg-[#d8d6d1] p-4 shadow-inner">
        <article
          data-lucky-draw-ticket-page
          className="mx-auto bg-white shadow-xl"
          style={{
            width: `${LUCKY_DRAW_PRINTABLE_WIDTH_MM[form.paperSize]}mm`,
            height: `${LUCKY_DRAW_TICKET_HEIGHT_MM}mm`,
            padding: "0 3mm 3mm",
            background: "#fff",
            color: "#000",
            fontFamily: "Arial, sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "start",
                gap: 2,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/jwc-h.png"
                style={{ width: "auto", height: 40, marginBottom: 5 }}
                alt="Cityfuns"
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 2px",
                    textAlign: "center",
                    fontSize: compact ? "7pt" : "8pt",
                    fontWeight: 600,
                    letterSpacing: ".04em",
                  }}
                >
                  {form.programName}
                </p>
                <h1
                  style={{
                    margin: "0 0 2px",
                    textAlign: "center",
                    fontSize: compact ? "10pt" : "12pt",
                    lineHeight: 1.08,
                    fontWeight: 600,
                  }}
                >
                  {form.ticketTitle}
                </h1>
                <p
                  style={{
                    margin: 0,
                    textAlign: "center",
                    fontSize: "7.5pt",
                    fontWeight: 600,
                  }}
                >
                  Phiếu {sampleTicket.sequence}/{sampleTicket.totalForOrder}
                </p>
              </div>
            </div>

            <div
              style={{
                borderTop: "0.3mm dashed #000",
                margin: "1.5mm 0",
                paddingTop: "1.5mm",
                display: "grid",
                gap: "1.5mm",
              }}
            >
              <div style={rowStyle}>
                <strong>Khách hàng</strong>
                <span style={{ overflowWrap: "anywhere" }}>
                  {sampleTicket.customerName}
                </span>
              </div>
              <div style={rowStyle}>
                <strong>Số điện thoại</strong>
                <span>{sampleTicket.customerPhone}</span>
              </div>
              <div style={rowStyle}>
                <strong>Mã đơn hàng</strong>
                <span style={{ overflowWrap: "anywhere", fontWeight: 700 }}>
                  {sampleTicket.orderId}
                </span>
              </div>
              <div style={rowStyle}>
                <strong>Ngày mua</strong>
                <span>{sampleTicket.purchasedAt}</span>
              </div>
              <div style={rowStyle}>
                <strong>Sản phẩm</strong>
                <span style={{ overflowWrap: "anywhere" }}>
                  {sampleTicket.goodsName}
                </span>
              </div>
            </div>

            <p
              style={{
                margin: "0 0 2mm",
                textAlign: "center",
                fontSize: compact ? "7pt" : "7.5pt",
                lineHeight: 1.3,
              }}
            >
              {form.message}
            </p>
            <div style={{ marginTop: "auto" }}>
              <OrderBarcode
                value={sampleTicket.orderId}
                height={compact ? 36 : 42}
              />
              <p
                style={{
                  margin: "1mm 0 0",
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontSize: compact ? "7pt" : "8pt",
                  fontWeight: 700,
                  letterSpacing: ".04em",
                }}
              >
                {sampleTicket.orderId}
              </p>
              <p
                style={{
                  margin: "2mm 0 0",
                  borderTop: "0.25mm solid #000",
                  paddingTop: "1.5mm",
                  textAlign: "center",
                  fontSize: "7.5pt",
                  fontWeight: 700,
                }}
              >
                {form.footerMessage}
              </p>
            </div>
          </div>
        </article>
      </div>
    </aside>
  );
}
