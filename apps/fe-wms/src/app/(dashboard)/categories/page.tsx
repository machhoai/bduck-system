'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useCategories } from '../../../hooks/useCategories';
import { useUserStore } from '../../../stores/useUserStore';
import { gooeyToast } from 'goey-toast';
import CategoryTree from '../../../components/categories/CategoryTree';
import CategoryFlatList from '../../../components/categories/CategoryFlatList';
import CategoryFormModal from '../../../components/categories/CategoryFormModal';
import CategorySkeleton from '../../../components/categories/CategorySkeleton';
import type { ProductCategory } from '@bduck/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.wms.localhost';

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { categories, isLoading } = useCategories();
  const hasPermission = useUserStore((s) => s.hasPermission);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<ProductCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Handlers ──

  const handleEdit = (cat: ProductCategory) => {
    setEditCategory(cat);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditCategory(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (cat: ProductCategory) => {
    if (!confirm(`${t.categories.confirmDelete}\n${t.categories.deleteWarning}`)) {
      return;
    }

    const deleteAction = async () => {
      const response = await fetch(`${API_BASE_URL}/api/categories/${cat.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.messages?.vi || t.categories.deleteError);
      }
    };

    try {
      await gooeyToast.promise(deleteAction(), {
        loading: t.categories.deleting,
        success: t.categories.deleteSuccess,
        error: (err: any) => err.message || t.categories.deleteError,
        action: {
          error: {
            label: t.common.retry,
            onClick: () => handleDelete(cat),
          },
        },
      });
    } catch (error) {
      console.error('[CategoriesPage] delete error:', error);
    }
  };

  // ── Filter ──
  const filtered = searchQuery
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t.categories.title}</h1>

        {hasPermission('category.create') && (
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium
              text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.97]"
          >
            <Plus size={18} />
            {t.categories.addNew}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.common.search}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm
            outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <CategorySkeleton />
      ) : (
        <>
          <CategoryTree
            categories={filtered}
            onEdit={handleEdit}
            onDelete={handleDelete}
            hasPermission={hasPermission}
          />
          <CategoryFlatList
            categories={filtered}
            onEdit={handleEdit}
            onDelete={handleDelete}
            hasPermission={hasPermission}
          />
        </>
      )}

      {/* Modal */}
      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditCategory(null);
        }}
        editCategory={editCategory}
        parentOptions={categories}
      />
    </div>
  );
}
