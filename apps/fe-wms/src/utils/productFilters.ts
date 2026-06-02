import type { Product, ProductCategory } from "@bduck/shared-types";

export type SerializedFilter = "all" | "serialized" | "standard";
export type StockFilter = "all" | "configured" | "missing";

export interface ProductFilters {
  search: string;
  categoryId: string;
  productType: string;
  origin: string;
  serialized: SerializedFilter;
  stock: StockFilter;
}

export const defaultProductFilters: ProductFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  origin: "all",
  serialized: "all",
  stock: "all",
};

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

  return products.filter((product) => {
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
  });
}
