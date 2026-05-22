'use client';

/**
 * i18n Provider & Hook — Lightweight dictionary-based i18n
 *
 * ► LÝ DO không dùng next-intl/react-i18next:
 *   Hệ thống WMS chỉ cần 2 ngôn ngữ (vi, zh) với số lượng text
 *   có giới hạn. Dictionary pattern đơn giản, zero-dependency,
 *   type-safe hoàn toàn với TypeScript.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import vi, { type Dictionary } from './vi';
import zh from './zh';

// ── Supported languages ──
export type Language = 'vi' | 'zh';

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
  defaultLang = 'vi',
}: {
  children: ReactNode;
  defaultLang?: Language;
}) {
  const [lang, setLangState] = useState<Language>(defaultLang);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wms-lang', newLang);
    }
  }, []);

  const t = dictionaries[lang];

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ──
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback khi không bọc Provider (SSR hoặc ngoài context)
    return { t: vi, lang: 'vi' as Language, setLang: () => {} };
  }
  return ctx;
}

export type { Dictionary };
