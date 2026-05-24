import { create } from "zustand";
import {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  saveLanguageSetting,
  type AppLanguage,
} from "../utils/appSettings";

interface AppSettingsState {
  language: AppLanguage;
  isHydrated: boolean;
  hydrateSettings: () => void;
  setLanguage: (language: AppLanguage) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()((set) => ({
  language: DEFAULT_LANGUAGE,
  isHydrated: false,

  hydrateSettings: () => {
    set({
      language: getStoredLanguage(),
      isHydrated: true,
    });
  },

  setLanguage: (language) => {
    saveLanguageSetting(language);
    set({ language });
  },
}));
