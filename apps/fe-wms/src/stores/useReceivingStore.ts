"use client";

import { create } from "zustand";
import {
  deleteReceivingDraft,
  loadReceivingDraft,
  saveReceivingDraft,
} from "@/lib/receivingDraftStorage";
import { useUserStore } from "@/stores/useUserStore";

export interface ReceivingItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_barcode: string;
  product_image_url: string | null;
  warehouse_location_id: string;
  location_name: string;
  expected_quantity: number;
  actual_quantity: number;
  notes: string;
}

interface ReceivingState {
  voucherId: string | null;
  voucherNumber: string | null;
  supplierName: string | null;
  items: ReceivingItem[];
  lastSavedAt: Date | null;
  isDirty: boolean;
  isSubmitting: boolean;
  isConfirmed: boolean;
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
  setSubmitting: (value: boolean) => void;
  setConfirmed: (value: boolean) => void;
  clearSession: () => void;
  clearSessionMemory: () => void;
}

const createEmptySession = () => ({
  voucherId: null,
  voucherNumber: null,
  supplierName: null,
  items: [] as ReceivingItem[],
  lastSavedAt: null,
  isDirty: false,
  isSubmitting: false,
  isConfirmed: false,
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function activeUserId() {
  return useUserStore.getState().user?.id ?? null;
}

function debouncedSave(
  ownerUserId: string,
  voucherId: string,
  items: ReceivingItem[],
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveReceivingDraft(ownerUserId, voucherId, items).catch((error) =>
      console.error("[useReceivingStore] draft save failed:", error),
    );
  }, 500);
}

function mergeSessionItems(
  sourceItems: ReceivingItem[],
  persistedItems: ReceivingItem[],
) {
  return sourceItems.map((sourceItem) => {
    const persistedItem = persistedItems.find(
      (item) => item.id === sourceItem.id,
    );
    return persistedItem
      ? {
          ...sourceItem,
          actual_quantity: persistedItem.actual_quantity,
          notes: persistedItem.notes,
        }
      : sourceItem;
  });
}

function initialItems(items: ReceivingItem[]) {
  const hasProgress = items.some(
    (item) => item.actual_quantity > 0 || item.notes.trim().length > 0,
  );
  return hasProgress
    ? items
    : items.map((item) => ({
        ...item,
        actual_quantity: item.expected_quantity,
      }));
}

export const useReceivingStore = create<ReceivingState>()((set, get) => ({
  ...createEmptySession(),

  initSession: async (voucherId, voucherNumber, supplierName, items) => {
    const ownerUserId = activeUserId();
    if (!ownerUserId) {
      set(createEmptySession());
      return;
    }
    const currentState = get();
    if (currentState.voucherId === voucherId && currentState.items.length > 0) {
      set({
        voucherId,
        voucherNumber,
        supplierName,
        items: mergeSessionItems(items, currentState.items),
      });
      return;
    }

    let draft: ReceivingItem[] | null = null;
    try {
      draft = await loadReceivingDraft(ownerUserId, voucherId);
    } catch (error) {
      console.error("[useReceivingStore] draft load failed:", error);
    }
    // Ignore an async result that belongs to the account that just signed out.
    if (activeUserId() !== ownerUserId) return;
    if (draft?.length) {
      set({
        voucherId,
        voucherNumber,
        supplierName,
        items: mergeSessionItems(items, draft),
        isDirty: true,
        lastSavedAt: new Date(),
      });
      return;
    }
    set({
      voucherId,
      voucherNumber,
      supplierName,
      items: initialItems(items),
      isDirty: false,
      lastSavedAt: null,
    });
  },

  updateItemQuantity: (itemId, quantity) => {
    const { voucherId, items } = get();
    const updated = items.map((item) =>
      item.id === itemId
        ? { ...item, actual_quantity: Math.max(0, quantity) }
        : item,
    );
    set({ items: updated, isDirty: true });
    const ownerUserId = activeUserId();
    if (ownerUserId && voucherId) debouncedSave(ownerUserId, voucherId, updated);
  },

  incrementByBarcode: (barcode) => {
    const { voucherId, items } = get();
    const index = items.findIndex(
      (item) =>
        item.product_barcode.toUpperCase() === barcode.toUpperCase() ||
        item.product_sku.toUpperCase() === barcode.toUpperCase(),
    );
    if (index === -1) return false;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      actual_quantity: updated[index].actual_quantity + 1,
    };
    set({ items: updated, isDirty: true });
    const ownerUserId = activeUserId();
    if (ownerUserId && voucherId) debouncedSave(ownerUserId, voucherId, updated);
    return true;
  },

  updateItemNotes: (itemId, notes) => {
    const { voucherId, items } = get();
    const updated = items.map((item) =>
      item.id === itemId ? { ...item, notes } : item,
    );
    set({ items: updated, isDirty: true });
    const ownerUserId = activeUserId();
    if (ownerUserId && voucherId) debouncedSave(ownerUserId, voucherId, updated);
  },

  markSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setConfirmed: (isConfirmed) => set({ isConfirmed }),

  clearSession: () => {
    const ownerUserId = activeUserId();
    const { voucherId } = get();
    if (ownerUserId && voucherId) {
      void deleteReceivingDraft(ownerUserId, voucherId).catch((error) =>
        console.error("[useReceivingStore] draft delete failed:", error),
      );
    }
    set(createEmptySession());
  },

  clearSessionMemory: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    set(createEmptySession());
  },
}));
