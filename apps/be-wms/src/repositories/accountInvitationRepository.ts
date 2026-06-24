import { randomUUID } from "crypto";
import type {
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { db } from "../config/firebase.js";

export const ACCOUNT_INVITATION_PURPOSE = "INITIAL_PASSWORD_SETUP" as const;
export const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET" as const;

export type AccountInvitationPurpose = 
  | typeof ACCOUNT_INVITATION_PURPOSE 
  | typeof PASSWORD_RESET_PURPOSE;

export interface AccountInvitation {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: AccountInvitationPurpose;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLLECTION = "account_invitations";

type CreateAccountInvitationInput = Pick<
  AccountInvitation,
  "user_id" | "token_hash" | "purpose" | "expires_at" | "created_by"
>;

const fromDoc = (
  doc: QueryDocumentSnapshot | DocumentSnapshot,
): AccountInvitation => {
  const data = doc.data() as AccountInvitation;
  return {
    ...data,
    id: data.id || doc.id,
  };
};

export const createAccountInvitation = async (
  input: CreateAccountInvitationInput,
): Promise<AccountInvitation> => {
  const now = new Date();
  const invitation: AccountInvitation = {
    id: randomUUID(),
    ...input,
    used_at: null,
    revoked_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.collection(COLLECTION).doc(invitation.id).set(invitation);
  return invitation;
};

export const findAccountInvitationByTokenHash = async (
  tokenHash: string,
): Promise<AccountInvitation | null> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("token_hash", "==", tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return fromDoc(snapshot.docs[0]);
};

export const findActiveInvitationForUser = async (
  userId: string,
  purpose: AccountInvitationPurpose,
): Promise<AccountInvitation | null> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .where("purpose", "==", purpose)
    .get();

  const activeDocs = snapshot.docs.filter((doc) => {
    const data = doc.data() as AccountInvitation;
    if (data.used_at || data.revoked_at) return false;
    
    let expiresTime = 0;
    if (data.expires_at instanceof Date) {
      expiresTime = data.expires_at.getTime();
    } else if (data.expires_at && typeof (data.expires_at as any).toDate === "function") {
      expiresTime = (data.expires_at as any).toDate().getTime();
    } else {
      expiresTime = new Date(String(data.expires_at)).getTime();
    }
    
    return expiresTime > Date.now();
  });

  if (activeDocs.length === 0) return null;
  return fromDoc(activeDocs[0]);
};

export const revokeActiveAccountInvitations = async (
  userId: string,
  purpose: AccountInvitation["purpose"],
): Promise<void> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("user_id", "==", userId)
    .where("purpose", "==", purpose)
    .get();

  const activeDocs = snapshot.docs.filter((doc) => {
    const data = doc.data() as AccountInvitation;
    return !data.used_at && !data.revoked_at;
  });

  if (activeDocs.length === 0) return;

  const now = new Date();
  const batch = db.batch();
  activeDocs.forEach((doc) => {
    batch.update(doc.ref, {
      revoked_at: now,
      updated_at: now,
    });
  });
  await batch.commit();
};

export const markAccountInvitationUsed = async (
  invitationId: string,
): Promise<void> => {
  const now = new Date();
  await db.collection(COLLECTION).doc(invitationId).update({
    used_at: now,
    updated_at: now,
  });
};

export const revokeAccountInvitation = async (
  invitationId: string,
): Promise<void> => {
  const now = new Date();
  await db.collection(COLLECTION).doc(invitationId).update({
    revoked_at: now,
    updated_at: now,
  });
};
