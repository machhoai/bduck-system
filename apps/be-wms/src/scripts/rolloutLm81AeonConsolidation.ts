import { FieldValue } from "firebase-admin/firestore";

import { db, getCurrentFirebaseProjectId } from "../config/firebase.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import { upsertExternalStoreBinding } from "../services/externalStoreBindingService.js";

const PRODUCTION_PROJECT_ID = "jw-system-f2104";
const LM81_WAREHOUSE_ID = "2fa83576-277f-483e-8c52-2ec85b9a8cff";
const AEON_WAREHOUSE_ID = "4ea64164-d889-43ee-82be-105eb88a3112";
const ACTOR_ID = "system-rollout-lm81-aeon-consolidation";

if (getCurrentFirebaseProjectId() !== PRODUCTION_PROJECT_ID) {
  throw new Error("PRODUCTION_PROJECT_REQUIRED");
}

const binding = await upsertExternalStoreBinding({
  id: "joyworld-legacy-lm81-aeon",
  source_system: "JOYWORLD_LEGACY",
  source_account_key: "joyworld-legacy-hk-lm81-aeon",
  mode: "CONSOLIDATED",
  canonical_warehouse_id: LM81_WAREHOUSE_ID,
  member_warehouse_ids: [LM81_WAREHOUSE_ID, AEON_WAREHOUSE_ID],
  display_name: "B.Duck Cityfuns Landmark 81 + AEON Mall Tân Phú",
  enabled: true,
  updated_by: ACTOR_ID,
});

if (process.argv.includes("--clone-invoice-config")) {
  const canonicalConfig = await meInvoiceConfigRepository.getStoreConfig(
    LM81_WAREHOUSE_ID,
  );
  if (!canonicalConfig || canonicalConfig.is_deleted === true) {
    throw new Error("CANONICAL_MEINVOICE_CONFIG_MISSING");
  }
  await meInvoiceConfigRepository.setStoreConfig(AEON_WAREHOUSE_ID, {
    ...canonicalConfig,
    warehouse_id: AEON_WAREHOUSE_ID,
    inherited_from_warehouse_id: LM81_WAREHOUSE_ID,
    external_store_binding_id: binding.id,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: ACTOR_ID,
    created_at: FieldValue.serverTimestamp(),
    created_by: ACTOR_ID,
    is_deleted: false,
  });
}

const storedBinding = await db
  .collection("external_store_bindings")
  .doc(binding.id)
  .get();
const aeonConfig = await meInvoiceConfigRepository.getStoreConfig(
  AEON_WAREHOUSE_ID,
);

process.stdout.write(
  `${JSON.stringify({
    project_id: getCurrentFirebaseProjectId(),
    binding_id: storedBinding.id,
    binding_enabled: storedBinding.data()?.enabled === true,
    canonical_warehouse_id: storedBinding.data()?.canonical_warehouse_id,
    member_count: Array.isArray(storedBinding.data()?.member_warehouse_ids)
      ? storedBinding.data()?.member_warehouse_ids.length
      : 0,
    aeon_invoice_configured: Boolean(aeonConfig && aeonConfig.is_deleted !== true),
    aeon_invoice_config_inherited:
      aeonConfig?.inherited_from_warehouse_id === LM81_WAREHOUSE_ID,
  })}\n`,
);
