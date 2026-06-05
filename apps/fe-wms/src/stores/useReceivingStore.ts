"use client";

/**
 * useReceivingStore — Zustand store for Receiving Session (Kiểm đếm)
 *
 * LOCAL-FIRST ARCHITECTURE:
 * - Auto-saves draft to IndexedDB on every change (debounced)
 * - Restores draft on mount if session was interrupted
 * - Only pushes to backend on explicit "Submit Actuals"
 *
 * BARCODE SCANNER:
 * - Listens for rapid keyboard input pattern
 * - Increments actual_quantity for the scanned product
 */

import { create } from "zustand";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ReceivingItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  warehouse_location_id: string;
  location_name: string;
  expected_quantity: number;
  actual_quantity: number;
  notes: string;
}

interface ReceivingState {
  // Data
  voucherId: string | null;
  voucherNumber: string | null;
  supplierName: string | null;
  items: ReceivingItem[];
  lastSavedAt: Date | null;
  isDirty: boolean;
  isSubmitting: boolean;
  isConfirmed: boolean;

  // Actions
  initSession: (
    voucherId: string,
    voucherNumber: string,
    supplierName: string,
    items: ReceivingItem[],
  ) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  incrementByBarcode: (sku: string) => boolean;
  updateItemNotes: (itemId: string, notes: string) => void;
  markSaved: () => void;
  setSubmitting: (v: boolean) => void;
  setConfirmed: (v: boolean) => void;
  clearSession: () => void;
}

// ─────────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────────

const IDB_NAME = "wms_receiving_drafts";
const IDB_STORE = "drafts";
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "voucherId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDraftToIDB(voucherId: string, items: ReceivingItem[]) {
  try {
    const idb = await openIDB();
    const txn = idb.transaction(IDB_STORE, "readwrite");
    txn.objectStore(IDB_STORE).put({
      voucherId,
      items,
      savedAt: new Date().toISOString(),
    });
    idb.close();
  } catch (err) {
    console.error("[useReceivingStore] IDB save failed:", err);
  }
}

async function loadDraftFromIDB(
  voucherId: string,
): Promise<ReceivingItem[] | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const txn = idb.transaction(IDB_STORE, "readonly");
      const req = txn.objectStore(IDB_STORE).get(voucherId);
      req.onsuccess = () => {
        idb.close();
        resolve(req.result?.items ?? null);
      };
      req.onerror = () => {
        idb.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function deleteDraftFromIDB(voucherId: string) {
  try {
    const idb = await openIDB();
    const txn = idb.transaction(IDB_STORE, "readwrite");
    txn.objectStore(IDB_STORE).delete(voucherId);
    idb.close();
  } catch (err) {
    console.error("[useReceivingStore] IDB delete failed:", err);
  }
}

// ─────────────────────────────────────────────
// Debounce helper
// ─────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(voucherId: string, items: ReceivingItem[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraftToIDB(voucherId, items);
  }, 500);
}

// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

export const useReceivingStore = create<ReceivingState>()((set, get) => ({
  voucherId: null,
  voucherNumber: null,
  supplierName: null,
  items: [],
  lastSavedAt: null,
  isDirty: false,
  isSubmitting: false,
  isConfirmed: false,

  initSession: async (voucherId, voucherNumber, supplierName, items) => {
    // Try to restore draft from IndexedDB
    const draft = await loadDraftFromIDB(voucherId);

    if (draft && draft.length > 0) {
      // Merge: keep server item structure but restore actual_quantity from draft
      const mergedItems = items.map((serverItem) => {
        const draftItem = draft.find((d) => d.id === serverItem.id);
        return draftItem
          ? { ...serverItem, actual_quantity: draftItem.actual_quantity, notes: draftItem.notes }
          : serverItem;
      });
      set({
        voucherId,
        voucherNumber,
        supplierName,
        items: mergedItems,
        isDirty: true,
        lastSavedAt: new Date(),
      });
    } else {
      set({
        voucherId,
        voucherNumber,
        supplierName,
        items,
        isDirty: false,
        lastSavedAt: null,
      });
    }
  },

  updateItemQuantity: (itemId, quantity) => {
    const { voucherId, items } = get();
    const updated = items.map((item) =>
      item.id === itemId ? { ...item, actual_quantity: Math.max(0, quantity) } : item,
    );
    set({ items: updated, isDirty: true });
    if (voucherId) debouncedSave(voucherId, updated);
  },

  incrementByBarcode: (sku) => {
    const { voucherId, items } = get();
    const idx = items.findIndex(
      (item) => item.product_sku.toUpperCase() === sku.toUpperCase(),
    );
    if (idx === -1) return false;

    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      actual_quantity: updated[idx].actual_quantity + 1,
    };
    set({ items: updated, isDirty: true });
    if (voucherId) debouncedSave(voucherId, updated);
    return true;
  },

  updateItemNotes: (itemId, notes) => {
    const { voucherId, items } = get();
    const updated = items.map((item) =>
      item.id === itemId ? { ...item, notes } : item,
    );
    set({ items: updated, isDirty: true });
    if (voucherId) debouncedSave(voucherId, updated);
  },

  markSaved: () => {
    set({ isDirty: false, lastSavedAt: new Date() });
  },

  setSubmitting: (v) => set({ isSubmitting: v }),
  setConfirmed: (v) => set({ isConfirmed: v }),

  clearSession: () => {
    const { voucherId } = get();
    if (voucherId) deleteDraftFromIDB(voucherId);
    set({
      voucherId: null,
      voucherNumber: null,
      supplierName: null,
      items: [],
      lastSavedAt: null,
      isDirty: false,
      isSubmitting: false,
      isConfirmed: false,
    });
  },
}));
