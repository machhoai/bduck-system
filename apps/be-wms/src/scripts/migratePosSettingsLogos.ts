import type { PosReceiptSettings, PosTicketSettings } from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import { POS_RECEIPT_SETTINGS_COLLECTION } from "../repositories/posReceiptSettingsRepository.js";
import { POS_TICKET_SETTINGS_COLLECTION } from "../repositories/posTicketSettingsRepository.js";
import { persistPosSettingsLogo } from "../services/posSettingsLogoStorageService.js";

const apply = process.argv.includes("--apply");

const targets = [
  { collection: POS_RECEIPT_SETTINGS_COLLECTION, kind: "receipt" as const },
  { collection: POS_TICKET_SETTINGS_COLLECTION, kind: "ticket" as const },
];

let discovered = 0;
let migrated = 0;

for (const target of targets) {
  const snapshot = await db.collection(target.collection).get();
  for (const document of snapshot.docs) {
    const value = document.data() as PosReceiptSettings | PosTicketSettings;
    if (!value.logo_data_url?.startsWith("data:image/")) continue;
    discovered += 1;
    console.info(
      `[pos-settings-logo-migration] ${apply ? "migrating" : "would migrate"}`,
      { kind: target.kind, warehouseId: document.id },
    );
    if (!apply) continue;
    const logo = await persistPosSettingsLogo({
      warehouseId: document.id,
      logoDataUrl: value.logo_data_url,
      currentSettings: value,
    });
    await document.ref.update({ ...logo });
    migrated += 1;
  }
}

console.info("[pos-settings-logo-migration] complete", {
  mode: apply ? "apply" : "dry-run",
  discovered,
  migrated,
});
