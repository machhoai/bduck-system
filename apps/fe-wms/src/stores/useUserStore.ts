import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@bduck/shared-types';

interface UserState {
  user: User | null;
  permissions: Record<string, Record<string, unknown>>;
  isAuthenticated: boolean;
  
  // Actions
  setAuthData: (user: User, permissions: Record<string, Record<string, unknown>>) => void;
  clearAuth: () => void;
  
  // Selectors
  hasPermission: (action: string, warehouseId?: string) => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: {},
      isAuthenticated: false,

      setAuthData: (user, permissions) => 
        set({ user, permissions, isAuthenticated: true }),

      clearAuth: () => 
        set({ user: null, permissions: {}, isAuthenticated: false }),

      hasPermission: (action: string, warehouseId?: string) => {
        const { permissions } = get();
        if (!permissions) return false;

        const globalPerms = permissions['global'] || {};
        
        // 1. Admin bypass
        if (globalPerms['*'] === true) return true;
        
        // 2. Global specific permission
        if (globalPerms[action] === true) return true;

        // 3. Warehouse specific permission
        if (warehouseId) {
          const warehousePerms = permissions[warehouseId] || {};
          if (warehousePerms['*'] === true || warehousePerms[action] === true) return true;
        }

        return false;
      }
    }),
    {
      name: 'wms-auth-storage',
      // We only persist non-sensitive or necessary data for fast re-render.
      // Firebase auth state listener is the source of truth, but this helps prevent UI flicker.
    }
  )
);
