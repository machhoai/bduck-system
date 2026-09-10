import type { PosLuckyDrawSettingsInput } from "@bduck/shared-types";

export const LUCKY_DRAW_TICKET_HEIGHT_MM = 90;
export const MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE = 50;
export const LUCKY_DRAW_PRINTABLE_WIDTH_MM = {
  POS58: 58,
  POS80: 80,
  POS82: 82,
} as const;

export const createDefaultPosLuckyDrawSettings =
  (): PosLuckyDrawSettingsInput => ({
    enabled: false,
    paperSize: "POS80",
    programName: "CHƯƠNG TRÌNH BỐC THĂM MAY MẮN",
    ticketTitle: "Phiếu bốc thăm",
    message:
      "Vui lòng kiểm tra thông tin trước khi bỏ vào thùng. Mọi thông tin sai sót sau khi bỏ vào thùng chúng tôi không chịu trách nhiệm.",
    footerMessage: "Chúc Quý khách may mắn!",
    packageTicketCounts: {},
  });
