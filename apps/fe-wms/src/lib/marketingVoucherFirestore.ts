import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
  MarketingVoucherJob,
  MarketingVoucherJobItem,
} from "@bduck/shared-types";
import type { DocumentData, DocumentSnapshot } from "firebase/firestore";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
};

const mapDates = <T>(
  snapshot: DocumentSnapshot<DocumentData>,
  nullableDates: string[] = [],
): T => {
  const data = { ...snapshot.data(), id: snapshot.id } as Record<
    string,
    unknown
  >;
  for (const field of [
    "created_at",
    "updated_at",
    "action_time",
    "sync_time",
  ]) {
    data[field] = toDate(data[field]);
  }
  for (const field of nullableDates) {
    data[field] = data[field] == null ? null : toDate(data[field]);
  }
  const legacy = data.legacy_metadata;
  if (legacy && typeof legacy === "object" && "migrated_at" in legacy) {
    data.legacy_metadata = {
      ...(legacy as Record<string, unknown>),
      migrated_at: toDate((legacy as Record<string, unknown>).migrated_at),
    };
  }
  return data as T;
};

export const mapMarketingVoucherCampaignDocument = (
  snapshot: DocumentSnapshot<DocumentData>,
) => mapDates<MarketingVoucherCampaign>(snapshot);

export const mapMarketingVoucherCodeDocument = (
  snapshot: DocumentSnapshot<DocumentData>,
) =>
  mapDates<MarketingVoucherCode>(snapshot, [
    "distributed_at",
    "used_at",
    "emailed_at",
    "revoked_at",
  ]);

export const mapMarketingVoucherJobDocument = (
  snapshot: DocumentSnapshot<DocumentData>,
) => mapDates<MarketingVoucherJob>(snapshot, ["completed_at"]);

export const mapMarketingVoucherJobItemDocument = (
  snapshot: DocumentSnapshot<DocumentData>,
) => mapDates<MarketingVoucherJobItem>(snapshot, ["completed_at"]);
