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

/** Common approval fields */
export interface Approvable {
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users — CHECK(creator_id <> approver_id)
  approved_at: Date | null;
}