"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "../../lib/i18n";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "dark" | "light";
}

export default function LanguageSwitcher({
  className = "",
  variant = "dark",
}: LanguageSwitcherProps) {
  const { t, lang, setLang } = useTranslation();
  const nextLanguage = lang === "vi" ? "zh" : "vi";
  const title =
    lang === "vi"
      ? `${t.sidebar.language}: ${t.sidebar.vietnamese}`
      : `${t.sidebar.language}: ${t.sidebar.chinese}`;

  const baseStyles =
    variant === "light"
      ? "text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 bg-white shadow-sm"
      : "text-white/65 hover:bg-white/10 hover:text-white";

  return (
    <button
      type="button"
      onClick={() => setLang(nextLanguage)}
      title={title}
      aria-label={title}
      className={`
        relative flex h-8 w-10 shrink-0 aspect-square items-center justify-center rounded-[var(--radius-sm)]
        transition-all duration-200 active:scale-95
        ${baseStyles}
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
