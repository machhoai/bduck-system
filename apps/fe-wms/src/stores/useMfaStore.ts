import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MfaStore {
  isLocked: boolean;
  lastActiveTime: number;
  lockScreen: () => void;
  unlockScreen: () => void;
  updateActivity: () => void;
}

export const useMfaStore = create<MfaStore>()(
  persist(
    (set) => ({
      isLocked: false,
      lastActiveTime: Date.now(),
      lockScreen: () => set({ isLocked: true }),
      unlockScreen: () => set({ isLocked: false, lastActiveTime: Date.now() }),
      updateActivity: () => set({ lastActiveTime: Date.now() }),
    }),
    {
      name: "mfa-storage",
    }
  )
);
