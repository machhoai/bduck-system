/* eslint-disable no-console */
import { loadEmployeeContractEnvironment } from "./employeeContractEnvLoader.js";

const PRODUCTION_PROJECT_ID = "jw-system-f2104";
const PAGE_SIZE = 500;
const CONCURRENT_BATCHES = 8;
const PROGRESS_INTERVAL = 50_000;

const readArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

const decodeProjectId = (encoded: string): string | null => {
  const credential = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8"),
  ) as { project_id?: string; projectId?: string };
  return credential.project_id ?? credential.projectId ?? null;
};

const prepareProductionEnvironment = () => {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("PRODUCTION_PURGE_REFUSES_FIRESTORE_EMULATOR");
  }
  if (!process.argv.includes("--apply")) {
    throw new Error("PRODUCTION_PURGE_REQUIRES_APPLY");
  }
  if (readArgument("confirm-project") !== PRODUCTION_PROJECT_ID) {
    throw new Error(`CONFIRM_PROJECT_REQUIRED:${PRODUCTION_PROJECT_ID}`);
  }

  const credential = process.env.PROD_FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!credential) {
    throw new Error("PROD_FIREBASE_SERVICE_ACCOUNT_BASE64_REQUIRED");
  }
  if (decodeProjectId(credential) !== PRODUCTION_PROJECT_ID) {
    throw new Error("PRODUCTION_CREDENTIAL_PROJECT_MISMATCH");
  }

  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = credential;
  process.env.FIREBASE_PROJECT_ID = PRODUCTION_PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT = PRODUCTION_PROJECT_ID;
  process.env.NODE_ENV = "production";
};

const main = async () => {
  loadEmployeeContractEnvironment();
  prepareProductionEnvironment();

  const [{ db, getCurrentFirebaseProjectId }, { FieldPath }] =
    await Promise.all([
      import("../config/firebase.js"),
      import("firebase-admin/firestore"),
    ]);

  if (getCurrentFirebaseProjectId() !== PRODUCTION_PROJECT_ID) {
    throw new Error("CONNECTED_FIREBASE_PROJECT_MISMATCH");
  }

  const campaignsSnapshot = await db
    .collection("marketing_voucher_campaigns")
    .where("is_deleted", "==", true)
    .get();
  const campaigns = campaignsSnapshot.docs.map((document) => ({
    id: document.id,
    name: String(document.get("name") ?? document.id),
    status: String(document.get("status") ?? ""),
  }));

  if (campaigns.length === 0) {
    console.log({ status: "NO_SOFT_DELETED_CAMPAIGNS" });
    return;
  }
  const invalidCampaign = campaigns.find(
    (campaign) => campaign.status !== "ENDED",
  );
  if (invalidCampaign) {
    throw new Error(`SOFT_DELETED_CAMPAIGN_NOT_ENDED:${invalidCampaign.id}`);
  }

  const activeCampaignsSnapshot = await db
    .collection("marketing_voucher_campaigns")
    .where("is_deleted", "==", false)
    .get();
  const activeCampaignIds = activeCampaignsSnapshot.docs.map(
    (document) => document.id,
  );
  const activeCountsBefore = new Map<string, number>();
  for (const campaignId of activeCampaignIds) {
    const aggregate = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", campaignId)
      .count()
      .get();
    activeCountsBefore.set(campaignId, aggregate.data().count);
  }

  const expectedCounts = new Map<string, number>();
  for (const campaign of campaigns) {
    const aggregate = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", campaign.id)
      .count()
      .get();
    expectedCounts.set(campaign.id, aggregate.data().count);
  }

  const expectedCodeDeletes = [...expectedCounts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  console.log({
    status: "PURGE_STARTED",
    projectId: PRODUCTION_PROJECT_ID,
    campaignDeletes: campaigns.length,
    expectedCodeDeletes,
    activeCampaignsPreserved: activeCampaignIds.length,
  });

  let deletedCodes = 0;
  let nextProgress = PROGRESS_INTERVAL;
  for (const campaign of campaigns) {
    let campaignDeletedCodes = 0;
    for (;;) {
      const page = await db
        .collection("marketing_voucher_codes")
        .where("campaign_id", "==", campaign.id)
        .orderBy(FieldPath.documentId())
        .select("campaign_id")
        .limit(PAGE_SIZE * CONCURRENT_BATCHES)
        .get();
      if (page.empty) break;

      const pages: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
      for (let offset = 0; offset < page.docs.length; offset += PAGE_SIZE) {
        pages.push(page.docs.slice(offset, offset + PAGE_SIZE));
      }
      const committed = await Promise.all(
        pages.map(async (documents) => {
          const batch = db.batch();
          documents.forEach((document) => batch.delete(document.ref));
          await batch.commit();
          return documents.length;
        }),
      );
      const committedCount = committed.reduce((sum, count) => sum + count, 0);
      deletedCodes += committedCount;
      campaignDeletedCodes += committedCount;
      while (deletedCodes >= nextProgress) {
        console.log({ status: "PURGE_PROGRESS", deletedCodes });
        nextProgress += PROGRESS_INTERVAL;
      }
    }

    const currentCampaign = await db
      .collection("marketing_voucher_campaigns")
      .doc(campaign.id)
      .get();
    if (
      !currentCampaign.exists ||
      currentCampaign.get("is_deleted") !== true ||
      currentCampaign.get("status") !== "ENDED"
    ) {
      throw new Error(`CAMPAIGN_STATE_CHANGED_DURING_PURGE:${campaign.id}`);
    }
    if (campaignDeletedCodes !== expectedCounts.get(campaign.id)) {
      throw new Error(
        `CAMPAIGN_DELETE_COUNT_MISMATCH:${campaign.id}:${campaignDeletedCodes}:${expectedCounts.get(campaign.id)}`,
      );
    }
    await currentCampaign.ref.delete();
    console.log({
      status: "CAMPAIGN_PURGED",
      campaignId: campaign.id,
      name: campaign.name,
      deletedCodes: campaignDeletedCodes,
    });
  }
  const activeCountsAfter = new Map<string, number>();
  for (const campaignId of activeCampaignIds) {
    const aggregate = await db
      .collection("marketing_voucher_codes")
      .where("campaign_id", "==", campaignId)
      .count()
      .get();
    activeCountsAfter.set(campaignId, aggregate.data().count);
  }
  for (const [campaignId, before] of activeCountsBefore) {
    const after = activeCountsAfter.get(campaignId);
    if (after !== before) {
      throw new Error(
        `ACTIVE_CAMPAIGN_CODE_COUNT_CHANGED:${campaignId}:${before}:${after}`,
      );
    }
  }

  const remainingSoftDeletedCampaigns = await db
    .collection("marketing_voucher_campaigns")
    .where("is_deleted", "==", true)
    .count()
    .get();
  console.log({
    status: "PURGE_COMPLETED",
    deletedCampaigns: campaigns.length,
    deletedCodes,
    remainingSoftDeletedCampaigns:
      remainingSoftDeletedCampaigns.data().count,
    activeCampaignsPreserved: activeCampaignIds.length,
    activeCodesPreserved: [...activeCountsAfter.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
  });
};

await main().catch((error) => {
  console.error(
    "[purgeSoftDeletedMarketingVoucherCampaignsProduction]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
