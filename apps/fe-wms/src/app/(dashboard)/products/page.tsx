"use client";

import { FolderTree, Package } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CategoryManagementPanel } from "@/components/categories/CategoryManagementPanel";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { useTranslation } from "@/lib/i18n";
import type { Product } from "@bduck/shared-types";

type ProductTab = "products" | "categories";

const TAB_QUERY_KEY = "tab";

export default function ProductsPage() {
  const { t } = useTranslation();
  const { products, loading, createProduct, updateProduct, deleteProduct } =
    useProducts();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const [activeTab, setActiveTab] = useState<ProductTab>("products");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(TAB_QUERY_KEY) === "categories") {
      setActiveTab("categories");
    }
  }, []);

  const changeTab = (tab: ProductTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "categories") {
      url.searchParams.set(TAB_QUERY_KEY, tab);
    } else {
      url.searchParams.delete(TAB_QUERY_KEY);
    }
    window.history.replaceState(null, "", url.toString());
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`${t.products.confirmDelete}\n${product.name}`)) return;

    const deleteAction = async () => {
      await deleteProduct(product.id);
    };

    try {
      await gooeyToast.promise(deleteAction(), {
        loading: t.products.deleting,
        success: t.products.deleteSuccess,
        error: (error: unknown) =>
          error instanceof Error ? error.message : t.products.deleteError,
        description: {
          success: t.products.deleteSuccessDescription,
          error: t.products.deleteErrorDescription,
        },
        action: {
          error: {
            label: t.common.retry,
            onClick: () => handleDelete(product),
          },
        },
      });
    } catch (error) {
      console.error("[ProductsPage] delete error:", error);
    }
  };

  const handleSave = async (payload: any) => {
    if (editingProduct) {
      return await updateProduct(editingProduct.id, payload);
    }

    return await createProduct(payload);
  };

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            {t.products.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t.products.description}</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <TabButton
            active={activeTab === "products"}
            icon={<Package size={16} />}
            label={t.products.tabProducts}
            onClick={() => changeTab("products")}
          />
          <TabButton
            active={activeTab === "categories"}
            icon={<FolderTree size={16} />}
            label={t.products.tabCategories}
            onClick={() => changeTab("categories")}
          />
        </div>
      </header>

      {activeTab === "products" ? (
        <ProductCatalog
          products={products}
          categories={categories}
          loading={loading || categoriesLoading}
          onAddNew={handleAddNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <CategoryManagementPanel />
      )}

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        onSave={handleSave}
      />
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
