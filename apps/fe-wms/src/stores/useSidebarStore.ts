import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  /** Desktop sidebar collapsed state */
  isCollapsed: boolean;
  /** Mobile drawer open state */
  isMobileDrawerOpen: boolean;

  // Actions
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileDrawerOpen: false,

      toggleCollapsed: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      openDrawer: () => set({ isMobileDrawerOpen: true }),
      closeDrawer: () => set({ isMobileDrawerOpen: false }),
    }),
    {
      name: "wms-sidebar",
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    },
  ),
);
