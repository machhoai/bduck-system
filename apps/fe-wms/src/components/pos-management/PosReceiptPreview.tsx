"use client";

import { QRCodeSVG } from "qrcode.react";

import type { PosReceiptSettingsPayload } from "@/api/posManagementApi";

import { usePosReceiptEditorCopy } from "./usePosReceiptEditorCopy";

const weightClass = (weight: number) => weight >= 800 ? "font-extrabold" : weight >= 700 ? "font-bold" : weight >= 600 ? "font-semibold" : weight >= 500 ? "font-medium" : "font-normal";
const fontSizeClass = (size: number) => {
  const sizes: Record<string, string> = {
    "6": "text-[6pt]", "6.5": "text-[6.5pt]", "7": "text-[7pt]", "7.5": "text-[7.5pt]",
    "8": "text-[8pt]", "8.5": "text-[8.5pt]", "9": "text-[9pt]", "9.5": "text-[9.5pt]",
    "10": "text-[10pt]", "10.5": "text-[10.5pt]", "11": "text-[11pt]", "11.5": "text-[11.5pt]",
    "12": "text-[12pt]", "12.5": "text-[12.5pt]", "13": "text-[13pt]", "13.5": "text-[13.5pt]",
    "14": "text-[14pt]", "14.5": "text-[14.5pt]", "15": "text-[15pt]", "15.5": "text-[15.5pt]", "16": "text-[16pt]",
  };
  return sizes[String(size)] ?? "text-[10pt]";
};

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

function PreviewRow({ label, value, boldClass = "font-normal" }: { label: string; value: string; boldClass?: string }) {
  return <div className={`flex items-baseline justify-between gap-3 ${boldClass}`}><span>{label}</span><span className="shrink-0 text-right tabular-nums">{value}</span></div>;
}

function VietnamFlagIcon({ heightMm = 4 }: { heightMm?: number }) {
  const widthMm = heightMm * 1.5;
  return (
    <svg
      viewBox="0 0 30 20"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        display: "inline-block",
        verticalAlign: "middle",
        borderRadius: "0.5px",
        flexShrink: 0,
      }}
      aria-label="Lá cờ Việt Nam"
      role="img"
    >
      <rect width="30" height="20" fill="#DA251D" />
      <path
        d="M 15 4 L 16.347 8.146 L 20.706 8.146 L 17.18 10.708 L 18.527 14.854 L 15 12.292 L 11.473 14.854 L 12.82 10.708 L 9.294 8.146 L 13.653 8.146 Z"
        fill="#FFCD00"
      />
    </svg>
  );
}

function ThemeMessageBanner({
  theme,
  message,
  fontSizePt,
  weight,
  compact,
}: {
  theme: PosReceiptSettingsPayload["theme"];
  message: string;
  fontSizePt: number;
  weight: number;
  compact: boolean;
}) {
  const marker = theme === "NATIONAL_DAY" ? "★" : theme === "TET" ? "◆" : "•";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1mm", flexDirection: "column" }}>
      <div
        className={`${fontSizeClass(fontSizePt)} ${weightClass(weight)}`}
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          alignItems: "center",
          gap: compact ? "1.5mm" : "2.5mm",
          marginTop: "3mm",
          padding: compact ? "0.8mm 0.5mm" : "0.2mm 1mm",
          lineHeight: 1.25,
          letterSpacing: theme === "NATIONAL_DAY" ? "0.25px" : "0",
          textAlign: "center",
        }}
      >
        <span aria-hidden="true">{marker}</span>
        <span>{message}</span>
        <span aria-hidden="true">{marker}</span>
      </div>
      {theme === "NATIONAL_DAY" && <VietnamFlagIcon />}
    </div>
  );
}

function ThemeDecoration({
  theme,
  weight,
  compact = false,
  placement = "bottom",
}: {
  theme: PosReceiptSettingsPayload["theme"];
  weight: number;
  compact?: boolean;
  placement?: "top" | "bottom";
}) {
  const lineStyle: React.CSSProperties = {
    flex: "1 1 auto",
    height: theme === "NATIONAL_DAY" ? "1.2mm" : "0",
    borderTop: "1px solid #000",
    borderBottom: theme === "NATIONAL_DAY" ? "1px solid #000" : undefined,
  };

  return (
    <div
      aria-hidden="true"
      className={weightClass(weight)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "1.5mm" : "2mm",
        marginTop: placement === "bottom" ? "3.5mm" : "0",
        marginBottom: placement === "top" ? "3.5mm" : "0",
      }}
    >
      <span style={lineStyle} />
      {theme === "NATIONAL_DAY" ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: compact ? "6mm" : "7mm",
            height: compact ? "6mm" : "7mm",
            border: "1.5px solid #000",
            borderRadius: "50%",
            fontSize: compact ? "11px" : "14px",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ) : theme === "TET" ? (
        <span style={{ display: "flex", alignItems: "center", gap: "2mm", padding: "0 1mm" }}>
          <span style={{ width: "2mm", height: "2mm", background: "#000", transform: "rotate(45deg)" }} />
          <span style={{ width: "5mm", height: "5mm", border: "1.5px solid #000", transform: "rotate(45deg)", padding: "1mm" }}>
            <span style={{ display: "block", width: "100%", height: "100%", background: "#000" }} />
          </span>
          <span style={{ width: "2mm", height: "2mm", background: "#000", transform: "rotate(45deg)" }} />
        </span>
      ) : (
        <span style={{ width: "3mm", height: "3mm", border: "1px solid #000", borderRadius: "50%" }} />
      )}
      <span style={lineStyle} />
    </div>
  );
}

export function PosReceiptPreview({ form }: { form: PosReceiptSettingsPayload }) {
  const { copy } = usePosReceiptEditorCopy();
  const weights = form.font_weights;
  const compact = form.paper_size === "POS58";
  const themeMessage = form.theme_messages[form.theme]?.trim();
  const paperClass = form.paper_size === "POS58" ? "w-[58mm] p-[3mm] text-[10px]" : form.paper_size === "POS82" ? "w-[82mm] p-[4mm] text-[11.5px]" : "w-[80mm] p-[4mm] text-[11.5px]";
  const logoContrastClass = form.logo_contrast_percent >= 175 ? "contrast-200" : form.logo_contrast_percent >= 135 ? "contrast-150" : form.logo_contrast_percent >= 110 ? "contrast-125" : "contrast-100";
  const qrPixels = Math.round(Math.min(form.invoice_qr_size_mm, compact ? 50 : 60) * 3);
  const titleBorderClass = form.theme === "TET" ? "border-y-2 border-black" : "border-y border-black";
  return (
    <aside className="rounded-xl border border-slate-200 bg-[#e9e8e5] p-4 xl:sticky xl:top-3">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">{copy.preview}</h3>
        <p className="text-[11px] text-slate-500">{form.paper_size.replace("POS", "")} mm · {copy.monochrome}</p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-[#d8d6d1] p-4 shadow-inner">
        <article className={`mx-auto min-h-40 bg-white font-sans leading-[1.35] text-black shadow-xl ${paperClass}`}>
          <header className="text-center">
            {form.show_logo && form.logo_data_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_data_url} alt={copy.logoAlt} width={Math.min(form.logo_width_mm * 3, compact ? 150 : 210)} height={form.logo_max_height_mm * 3} className={`mx-auto mb-2 max-w-full object-contain grayscale ${logoContrastClass}`} />
            )}
            <div className={`${compact ? "text-[15px]" : "text-[18px]"} ${weightClass(weights.storeName)}`}>{form.store_name}</div>
            {form.store_address && <div className={`mt-1 ${weightClass(weights.storeDetails)}`}>{form.store_address}</div>}
            {form.show_contact && form.hotline && <div className={`mt-0.5 ${weightClass(weights.storeDetails)}`}>{copy.hotlineLabel}: {form.hotline}</div>}
            {form.show_theme_message && themeMessage && (
              <ThemeMessageBanner
                theme={form.theme}
                message={themeMessage}
                fontSizePt={form.theme_message_font_size_pt}
                weight={weights.themeMessage}
                compact={compact}
              />
            )}
            <div className={`my-3 ${titleBorderClass} py-1.5 uppercase tracking-wide ${compact ? "text-xs" : "text-sm"} ${weightClass(weights.receiptTitle)}`}>{copy.receiptTitle}</div>
          </header>
          <section className={`grid gap-1 ${weightClass(weights.orderInfo)}`}>
            <PreviewRow label={`${copy.orderCode}:`} value="ORD-A29F8C" />
            <PreviewRow label={`${copy.dateTime}:`} value="02/09/2026 10:11" />
            {form.show_cashier && <PreviewRow label={`${copy.cashier}:`} value="Nguyễn Minh Anh" />}
            <PreviewRow label={`${copy.payment}:`} value={copy.cashPayment} />
          </section>
          <div className="my-3 border-t border-dashed border-black" />
          <section>
            <PreviewRow label={copy.goods} value={copy.amount} boldClass={weightClass(weights.tableHeader)} />
            <div className="mt-2 grid gap-2">
              {[[copy.sampleTicket, 1, 220000], [copy.sampleGift, 2, 54450]].map(([name, quantity, price]) => (
                <div key={String(name)}>
                  <div className={weightClass(weights.itemName)}>{name}</div>
                  <PreviewRow label={`${quantity} × ${money(Number(price))}`} value={money(Number(quantity) * Number(price))} boldClass={weightClass(weights.itemDetails)} />
                  {form.show_item_tax && <PreviewRow label={`${copy.itemTax} 10%`} value={money(Number(quantity) * Number(price) / 11)} boldClass={`${weightClass(weights.itemTax)} text-[0.92em]`} />}
                </div>
              ))}
            </div>
          </section>
          <div className="my-3 border-t border-dashed border-black" />
          <section className={`grid gap-1 ${weightClass(weights.summary)}`}>
            <PreviewRow label={copy.subtotal} value={money(328900)} />
            <PreviewRow label={`${copy.discount} (WELCOME)`} value={`-${money(20000)}`} />
            <PreviewRow label={copy.taxTotal} value={money(29900)} boldClass={weightClass(weights.taxTotal)} />
            <div className={`mt-1 border-t-2 border-black pt-2 ${compact ? "text-sm" : "text-base"}`}><PreviewRow label={copy.total} value={money(308900)} boldClass={weightClass(weights.grandTotal)} /></div>
          </section>
          <footer className="mt-4 text-center">
            {form.show_invoice_request_qr && (
              <section className="mb-3 border-t border-dashed border-black pt-3">
                <div className={`${fontSizeClass(form.invoice_qr_title_font_size_pt)} ${weightClass(weights.invoiceQrTitle)}`}>{copy.invoiceQrTitle}</div>
                <div className="my-2 flex justify-center"><QRCodeSVG value="https://invoice-preview.local/request/sample" size={qrPixels} level="M" marginSize={1} /></div>
                <div className={`${fontSizeClass(form.invoice_qr_hint_font_size_pt)} ${weightClass(weights.invoiceQrHint)}`}>{copy.invoiceQrHint}</div>
              </section>
            )}
            {form.show_contact && form.after_sales_text && <div className={`border-t border-dashed border-black pt-3 ${weightClass(weights.footer)}`}>{form.after_sales_text}</div>}
            {form.footer_message && <div className={`mt-2 ${weightClass(weights.footer)}`}>{form.footer_message}</div>}
            <div><ThemeDecoration theme={form.theme} weight={weights.decoration} compact={compact} placement="bottom" /></div>
          </footer>
        </article>
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">{copy.previewHint}</p>
    </aside>
  );
}
