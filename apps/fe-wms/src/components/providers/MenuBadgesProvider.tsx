"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMenuBadges } from "@/hooks/useMenuBadges";

type MenuBadges = ReturnType<typeof useMenuBadges>;

const MenuBadgesContext = createContext<MenuBadges | null>(null);

export function MenuBadgesProvider({ children }: { children: ReactNode }) {
  const badges = useMenuBadges();
  return (
    <MenuBadgesContext.Provider value={badges}>
      {children}
    </MenuBadgesContext.Provider>
  );
}

export function useLayoutMenuBadges() {
  const badges = useContext(MenuBadgesContext);
  if (!badges) {
    throw new Error(
      "useLayoutMenuBadges must be used inside MenuBadgesProvider",
    );
  }
  return badges;
}
