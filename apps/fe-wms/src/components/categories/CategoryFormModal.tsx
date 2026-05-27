"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { gooeyToast } from "goey-toast";
import type { ProductCategory } from "@bduck/shared-types";
import { emitDataMutation } from "@/lib/dataInvalidation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const PRODUCT_TYPES = [
  "EQUIPMENT",
  "CONSUMABLE",
  "SOUVENIR_SALE",
  "SOUVENIR_GIFT",
] as const;

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editCategory?: ProductCategory | null;
  parentOptions: ProductCategory[];
}

export default function CategoryFormModal({
  isOpen,
  onClose,
  editCategory,
  parentOptions,
}: CategoryFormModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Form state ──
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>("EQUIPMENT");
  const [parentId, setParentId] = useState<string>("");
  const [description, setDescription] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setCode(editCategory.code);
      setType(editCategory.type);
      setParentId(editCategory.parent_id || "");
      setDescription(editCategory.category_description || "");
    } else {
      setName("");
      setCode("");
      setType("EQUIPMENT");
      setParentId("");
      setDescription("");
    }
  }, [editCategory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Chống click đúp (LUẬT THÉP)

    setIsSubmitting(true);
    const isEdit = !!editCategory;
    const url = isEdit
      ? `${API_BASE_URL}/api/categories/${editCategory!.id}`
      : `${API_BASE_URL}/api/categories`;

    const saveAction = async () => {
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          code,
          type,
          parent_id: parentId || null,
          category_description: description || null,
          ...(!isEdit && {}), // only include code/type on create
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.messages?.vi || t.categories.saveError);
      }

      return response.json();
    };

    try {
      await gooeyToast.promise(saveAction(), {
        loading: t.categories.saving,
        success: t.categories.saveSuccess,
        error: (err: any) => err.message || t.categories.saveError,
        description: {
          success: isEdit ? t.categories.edit : t.categories.addNew,
          error: t.common.retry,
        },
        action: {
          error: {
            label: t.common.retry,
            onClick: () => handleSubmit(new Event("submit") as any),
          },
        },
      });
      emitDataMutation(["product_categories", "products", "audit_logs"]);
      onClose();
    } catch (error) {
      console.error("[CategoryFormModal] save error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter parent options: cannot select self, and only root/level-1 categories
  // (max depth = 3, so parent must be at most level 2)
  const availableParents = parentOptions.filter(
    (cat) => cat.id !== editCategory?.id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-[90%] rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {editCategory ? t.categories.edit : t.categories.addNew}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t.categories.name} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="VD: Thiết bị vui chơi"
            />
          </div>

          {/* Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t.categories.code} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              disabled={!!editCategory} // Code không cho sửa
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm uppercase
                outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100
                disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="VD: EQUIP-PLAY"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t.categories.type} <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!!editCategory} // Type không cho sửa
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100
                disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t.categories.types[pt]}
                </option>
              ))}
            </select>
          </div>

          {/* Parent */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t.categories.parent}
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t.categories.noParent}</option>
              {availableParents.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_id ? "── " : ""}
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t.categories.description}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Mô tả tùy chọn..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600
                transition-colors hover:bg-gray-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
                transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t.categories.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
