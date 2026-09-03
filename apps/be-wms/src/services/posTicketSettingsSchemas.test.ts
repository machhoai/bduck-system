import assert from "node:assert/strict";
import test from "node:test";

import { posTicketSettingsSchema } from "./posTicketSettingsSchemas.js";

const validSettings = {
  paper_size: "POS80",
  ticket_height_mm: 112,
  store_name: "JOY POS",
  ticket_title: "VÉ VUI CHƠI",
  subtitle: "Xuất trình vé trước khi tham gia",
  instructions: "Mỗi vé chỉ có giá trị một lượt.",
  footer_message: "Chúc Quý khách vui vẻ!",
  logo_data_url: null,
  logo_width_mm: 24,
  logo_max_height_mm: 16,
  logo_contrast_percent: 125,
  qr_size_mm: 34,
  title_font_size_pt: 15,
  product_font_size_pt: 13,
  body_font_size_pt: 8,
  font_weight: 700,
  show_logo: true,
  show_order_code: true,
  show_issued_at: true,
  show_price: false,
  show_sequence: true,
  auto_print_after_payment: true,
} as const;

test("accepts a complete ticket settings payload", () => {
  assert.equal(
    posTicketSettingsSchema.parse(validSettings).ticket_title,
    "VÉ VUI CHƠI",
  );
});

test("rejects unsafe text and out-of-range print values", () => {
  assert.equal(
    posTicketSettingsSchema.safeParse({
      ...validSettings,
      store_name: "$where",
    }).success,
    false,
  );
  assert.equal(
    posTicketSettingsSchema.safeParse({ ...validSettings, qr_size_mm: 90 })
      .success,
    false,
  );
});

test("only accepts supported inline logo formats", () => {
  assert.equal(
    posTicketSettingsSchema.safeParse({
      ...validSettings,
      logo_data_url: "data:image/svg+xml;base64,PHN2Zz4=",
    }).success,
    false,
  );
  assert.equal(
    posTicketSettingsSchema.safeParse({
      ...validSettings,
      logo_data_url: "data:image/png;base64,iVBORw0KGgo=",
    }).success,
    true,
  );
  assert.equal(
    posTicketSettingsSchema.safeParse({
      ...validSettings,
      logo_data_url: "https://storage.googleapis.com/example/logo.png?signature=test",
    }).success,
    true,
  );
});
