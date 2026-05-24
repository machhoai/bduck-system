"use client";

/**
 * i18n Provider & Hook — Lightweight dictionary-based i18n
 *
 * ► LÝ DO không dùng next-intl/react-i18next:
 *   Hệ thống WMS chỉ cần 2 ngôn ngữ (vi, zh) với số lượng text
 *   có giới hạn. Dictionary pattern đơn giản, zero-dependency,
 *   type-safe hoàn toàn với TypeScript.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import vi, { type Dictionary } from "./vi";
import zh from "./zh";
import { useAppSettingsStore } from "../../stores/useAppSettingsStore";
import { DEFAULT_LANGUAGE, type AppLanguage } from "../../utils/appSettings";

// ── Supported languages ──
export type Language = AppLanguage;

const dictionaries: Record<Language, Dictionary> = { vi, zh };

// ── Context ──
interface I18nContextType {
  t: Dictionary;
  lang: Language;
  setLang: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

// ── Provider ──
export function I18nProvider({
  children,
  defaultLang = DEFAULT_LANGUAGE,
}: {
  children: ReactNode;
  defaultLang?: Language;
}) {
  const lang = useAppSettingsStore((s) => s.language);
  const isHydrated = useAppSettingsStore((s) => s.isHydrated);
  const hydrateSettings = useAppSettingsStore((s) => s.hydrateSettings);
  const setLanguage = useAppSettingsStore((s) => s.setLanguage);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (newLang: Language) => {
      setLanguage(newLang);
    },
    [setLanguage],
  );

  const currentLang = isHydrated ? lang : defaultLang;
  const t = dictionaries[currentLang];

  return (
    <I18nContext.Provider value={{ t, lang: currentLang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ──
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback khi không bọc Provider (SSR hoặc ngoài context)
    return { t: vi, lang: "vi" as Language, setLang: () => {} };
  }
  return ctx;
}

export type { Dictionary };
