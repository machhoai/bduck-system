"use client";

import { FolderTree } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export default function CategoriesPage() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    router.replace("/products?tab=categories");
  }, [router]);

  return (
    <div className="mx-auto flex min-h-80 max-w-4xl flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
        <FolderTree size={24} />
      </div>
      <h1 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
        {t.products.redirectingCategories}
      </h1>
      <p className="mt-1 text-[17px] text-[var(--color-text-muted)]">
        {t.products.categoryHint}
      </p>
    </div>
  );
}
