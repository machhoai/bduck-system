import type { Product, ProductCategory } from "@bduck/shared-types";

export type SerializedFilter = "all" | "serialized" | "standard";
export type StockFilter = "all" | "configured" | "missing";
export type ProductSortField =
  | "name"
  | "code"
  | "barcode"
  | "unit_price"
  | "product_type"
  | "product_origin"
  | "created_at"
  | "updated_at";
export type ProductSortDirection = "asc" | "desc";

export interface ProductFilters {
  search: string;
  categoryId: string;
  productType: string;
  origin: string;
  serialized: SerializedFilter;
  stock: StockFilter;
  sortField: ProductSortField;
  sortDirection: ProductSortDirection;
}

export const defaultProductFilters: ProductFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  origin: "all",
  serialized: "all",
  stock: "all",
  sortField: "created_at",
  sortDirection: "desc",
};

function getProductSortValue(product: Product, field: ProductSortField): string | number {
  if (field === "created_at" || field === "updated_at") {
    const val = product[field];
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    if (
      typeof val === "object" &&
      val !== null &&
      "toDate" in val &&
      typeof (val as any).toDate === "function"
    ) {
      return (val as any).toDate().getTime();
    }
    const parsed = new Date(val as any).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (field === "unit_price") {
    return product.unit_price ?? 0;
  }
  return String(product[field] || "").toLowerCase();
}

export function filterProducts(
  products: Product[],
  categories: ProductCategory[],
  filters: ProductFilters,
) {
  const categoryNameById = new Map(
    categories.map((category) => [
      category.id,
      `${category.name} ${category.code}`.toLowerCase(),
    ]),
  );
  const search = filters.search.trim().toLowerCase();

  return products
    .filter((product) => {
      const categoryText = categoryNameById.get(product.category_id) || "";
      const haystack = [
        product.name,
        product.code,
        product.barcode,
        product.unit,
        product.product_material,
        product.description,
        product.product_type,
        product.product_origin,
        categoryText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !haystack.includes(search)) return false;
      if (
        filters.categoryId !== "all" &&
        product.category_id !== filters.categoryId
      ) {
        return false;
      }
      if (
        filters.productType !== "all" &&
        product.product_type !== filters.productType
      ) {
        return false;
      }
      if (filters.origin !== "all" && product.product_origin !== filters.origin) {
        return false;
      }
      if (filters.serialized === "serialized" && product.is_serialized !== true) {
        return false;
      }
      if (filters.serialized === "standard" && product.is_serialized === true) {
        return false;
      }
      if (filters.stock === "configured" && product.unit_price == null) {
        return false;
      }
      if (filters.stock === "missing" && product.unit_price != null) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const left = getProductSortValue(a, filters.sortField);
      const right = getProductSortValue(b, filters.sortField);
      const modifier = filters.sortDirection === "asc" ? 1 : -1;

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * modifier;
      }

      return String(left).localeCompare(String(right), "vi") * modifier;
    });
}
