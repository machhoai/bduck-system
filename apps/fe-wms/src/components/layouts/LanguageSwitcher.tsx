"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "../../lib/i18n";

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({
  className = "",
}: LanguageSwitcherProps) {
  const { t, lang, setLang } = useTranslation();
  const nextLanguage = lang === "vi" ? "zh" : "vi";
  const title =
    lang === "vi"
      ? `${t.sidebar.language}: ${t.sidebar.vietnamese}`
      : `${t.sidebar.language}: ${t.sidebar.chinese}`;

  return (
    <button
      type="button"
      onClick={() => setLang(nextLanguage)}
      title={title}
      aria-label={title}
      className={`
        relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg flex-1 aspect-square
        text-[var(--color-text-muted)] transition-all duration-200
        hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]
        ${className}
      `}
    >
      <Languages size={18} strokeWidth={1.7} />
      <span
        className="
          absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full
          bg-[var(--color-brand-primary)] px-1 text-[9px] font-bold text-[#0A0A0F]
        "
      >
        {lang.toUpperCase()}
      </span>
    </button>
  );
}
