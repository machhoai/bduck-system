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
    <div className="flex min-h-80 w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-4 text-center">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
        <FolderTree size={24} />
      </div>
      <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
        {t.products.redirectingCategories}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {t.products.categoryHint}
      </p>
    </div>
  );
}
