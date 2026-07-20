import type { EncryptedCredential } from "../services/meInvoiceCredentialCrypto.js";
import { db } from "../config/firebase.js";

export interface StoredMeInvoiceAccount {
  id: string;
  legal_entity_id: string;
  display_name: string;
  tax_code: string;
  environment: string;
  base_url: string;
  enabled: boolean;
  credential_revision?: number;
  client_id?: EncryptedCredential;
  client_secret?: EncryptedCredential;
  username?: EncryptedCredential;
  password?: EncryptedCredential;
  last_tested_at?: unknown;
  last_test_succeeded?: boolean | null;
  last_test_error_code?: string | null;
  last_template_sync_at?: unknown;
  created_by: string;
  updated_by: string;
  is_deleted: boolean;
  created_at: unknown;
  updated_at: unknown;
}

export interface StoredMeInvoiceToken {
  account_id: string;
  token: EncryptedCredential;
  credential_revision: number;
  refresh_after: unknown;
  expires_at: unknown;
  updated_at: unknown;
}

const accounts = db.collection("meinvoice_accounts");
const storeConfigs = db.collection("meinvoice_store_configs");
const tokens = db.collection("meinvoice_tokens");

export const meInvoiceConfigRepository = {
  async listAccounts(): Promise<StoredMeInvoiceAccount[]> {
    const snapshot = await accounts.where("is_deleted", "==", false).get();
    return snapshot.docs.map((doc) => doc.data() as StoredMeInvoiceAccount);
  },

  async getAccount(id: string): Promise<StoredMeInvoiceAccount | null> {
    const snapshot = await accounts.doc(id).get();
    return snapshot.exists ? (snapshot.data() as StoredMeInvoiceAccount) : null;
  },

  async setAccount(id: string, value: Record<string, unknown>): Promise<void> {
    await accounts.doc(id).set(value, { merge: true });
  },

  async getStoreConfig(warehouseId: string): Promise<Record<string, unknown> | null> {
    const snapshot = await storeConfigs.doc(warehouseId).get();
    return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
  },

  async setStoreConfig(warehouseId: string, value: Record<string, unknown>): Promise<void> {
    await storeConfigs.doc(warehouseId).set(value, { merge: true });
  },

  async getToken(accountId: string): Promise<StoredMeInvoiceToken | null> {
    const snapshot = await tokens.doc(accountId).get();
    return snapshot.exists ? (snapshot.data() as StoredMeInvoiceToken) : null;
  },

  async setToken(accountId: string, value: StoredMeInvoiceToken): Promise<void> {
    await tokens.doc(accountId).set(value);
  },
};
