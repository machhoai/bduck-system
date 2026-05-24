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
    <div className="mx-auto flex min-h-80 max-w-4xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <FolderTree size={24} />
      </div>
      <h1 className="text-lg font-semibold text-gray-950">
        {t.products.redirectingCategories}
      </h1>
      <p className="mt-1 text-sm text-gray-500">{t.products.categoryHint}</p>
    </div>
  );
}
