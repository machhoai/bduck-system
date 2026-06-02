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
        relative flex h-8 w-10 shrink-0 flex-1 aspect-square items-center justify-center rounded-[var(--radius-sm)]
        text-white/65 transition-all duration-200 active:scale-95
        hover:bg-white/10 hover:text-white
        ${className}
      `}
    >
      <Languages size={18} strokeWidth={1.7} />
      <span
        className="
          absolute -right-1 -top-1 flex size-5 aspect-square items-center justify-center rounded-full
          bg-[var(--color-brand-primary)] px-1 text-micro font-semibold text-white
        "
      >
        {lang.toUpperCase()}
      </span>
    </button>
  );
}
