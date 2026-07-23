// ============================================================
// UTILITY TYPES
// ============================================================

/** Common soft-delete + timestamp fields shared by most tables */
export interface SoftDeletable {
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Common ISO audit time fields (action_time + sync_time) */
export interface ISOTimestamped {
  action_time: Date; // Client-side timestamp (offline)
  sync_time: Date; // Server-side timestamp
}

/** Localized copy required for every user-facing business message. */
export interface LocalizedText {
  vi: string;
  zh: string;
}

/**
 * Calendar-only date in YYYY-MM-DD format.
 *
 * HR policies use Vietnam calendar dates and must not shift when serialized
 * between clients, Firestore, and the backend.
 */
export type LocalDate = string;

/** Common approval fields */
export interface Approvable {
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users — CHECK(creator_id <> approver_id)
  approved_at: Date | null;
}
