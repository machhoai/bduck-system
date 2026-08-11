"use client";

import type { PosTicketSettingsPayload } from "@/api/posManagementApi";

import {
  ReceiptSection,
  ReceiptSlider,
  ReceiptTextArea,
  ReceiptToggle,
} from "./PosReceiptFields";
import { usePosTicketEditorCopy } from "./usePosTicketEditorCopy";

type Update = <K extends keyof PosTicketSettingsPayload>(
  key: K,
  value: PosTicketSettingsPayload[K],
) => void;

export function PosTicketContentSection({
  form,
  update,
}: {
  form: PosTicketSettingsPayload;
  update: Update;
}) {
  const { copy } = usePosTicketEditorCopy();
  return (
    <ReceiptSection
      title={copy.contentTitle}
      description={copy.contentDescription}
    >
      <div className="grid gap-3">
        <ReceiptTextArea
          label={copy.instructions}
          value={form.instructions}
          onChange={(value) => update("instructions", value)}
          maxLength={500}
        />
        <ReceiptTextArea
          label={copy.footer}
          value={form.footer_message}
          onChange={(value) => update("footer_message", value)}
          maxLength={300}
          rows={2}
        />
      </div>
    </ReceiptSection>
  );
}

export function PosTicketTypographySection({
  form,
  update,
}: {
  form: PosTicketSettingsPayload;
  update: Update;
}) {
  const { copy } = usePosTicketEditorCopy();
  return (
    <ReceiptSection title={copy.typeTitle} description={copy.typeDescription}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReceiptSlider
          label={copy.qrSize}
          value={form.qr_size_mm}
          min={20}
          max={55}
          step={1}
          unit="mm"
          onChange={(value) => update("qr_size_mm", value)}
        />
        <ReceiptSlider
          label={copy.titleSize}
          value={form.title_font_size_pt}
          min={8}
          max={28}
          step={0.5}
          unit="pt"
          onChange={(value) => update("title_font_size_pt", value)}
        />
        <ReceiptSlider
          label={copy.productSize}
          value={form.product_font_size_pt}
          min={8}
          max={24}
          step={0.5}
          unit="pt"
          onChange={(value) => update("product_font_size_pt", value)}
        />
        <ReceiptSlider
          label={copy.bodySize}
          value={form.body_font_size_pt}
          min={6}
          max={16}
          step={0.5}
          unit="pt"
          onChange={(value) => update("body_font_size_pt", value)}
        />
        <ReceiptSlider
          label={copy.fontWeight}
          value={form.font_weight}
          min={400}
          max={900}
          step={100}
          unit=""
          onChange={(value) => update("font_weight", value)}
        />
      </div>
    </ReceiptSection>
  );
}

export function PosTicketDisplaySection({
  form,
  update,
}: {
  form: PosTicketSettingsPayload;
  update: Update;
}) {
  const { copy } = usePosTicketEditorCopy();
  const toggles: Array<[keyof PosTicketSettingsPayload, string, string]> = [
    ["show_logo", copy.showLogo, copy.showLogoHint],
    ["show_order_code", copy.showOrder, copy.showOrderHint],
    ["show_issued_at", copy.showIssued, copy.showIssuedHint],
    ["show_price", copy.showPrice, copy.showPriceHint],
    ["show_sequence", copy.showSequence, copy.showSequenceHint],
    ["auto_print_after_payment", copy.autoPrint, copy.autoPrintHint],
  ];
  return (
    <ReceiptSection
      title={copy.displayTitle}
      description={copy.displayDescription}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {toggles.map(([key, label, description]) => (
          <ReceiptToggle
            key={key}
            label={label}
            description={description}
            checked={Boolean(form[key])}
            onChange={(value) => update(key, value)}
          />
        ))}
      </div>
    </ReceiptSection>
  );
}
