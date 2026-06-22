import type {
  ExternalQueueScannableProductConfig,
  Product,
} from "@bduck/shared-types";
import * as configRepo from "../repositories/externalQueueScannableProductRepository.js";
import { locationRepository } from "../repositories/locationRepository.js";
import { productRepository } from "../repositories/productRepository.js";

export type ScannableProductConfigView = ExternalQueueScannableProductConfig & {
  products: Pick<Product, "id" | "name" | "code" | "barcode" | "unit">[];
};

const assertLocationBelongsToWarehouse = async (
  warehouseId: string,
  locationId: string,
) => {
  const location = await locationRepository.findById(locationId);
  if (
    !location ||
    location.is_deleted ||
    location.warehouse_id !== warehouseId
  ) {
    throw new Error("INVALID_LOCATION");
  }
};

export const getConfigForLocation = async (
  locationId: string,
): Promise<ExternalQueueScannableProductConfig | null> =>
  configRepo.findByLocationId(locationId);

export const getConfigViewForLocation = async (
  warehouseId: string,
  locationId: string,
): Promise<ScannableProductConfigView | null> => {
  await assertLocationBelongsToWarehouse(warehouseId, locationId);

  const config = await configRepo.findByLocationId(locationId);
  if (!config) return null;

  const products = await productRepository.findByIds(config.product_ids);
  const productById = new Map(products.map((product) => [product.id, product]));

  return {
    ...config,
    products: config.product_ids
      .map((productId) => productById.get(productId))
      .filter((product): product is Product => Boolean(product))
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        barcode: product.barcode,
        unit: product.unit,
      })),
  };
};

export const upsertConfigForLocation = async (params: {
  warehouseId: string;
  locationId: string;
  productIds: string[];
  updatedBy: string;
}): Promise<ScannableProductConfigView> => {
  await assertLocationBelongsToWarehouse(params.warehouseId, params.locationId);

  const products = await productRepository.findByIds(params.productIds);
  const validProductIds = new Set(products.map((product) => product.id));
  const unknownProductIds = params.productIds.filter(
    (productId) => !validProductIds.has(productId),
  );

  if (unknownProductIds.length > 0) {
    throw new Error("INVALID_PRODUCTS");
  }

  const config = await configRepo.upsertForLocation(params);
  return {
    ...config,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      unit: product.unit,
    })),
  };
};

export const isProductAllowedForLocation = async (
  locationId: string,
  productId: string,
): Promise<boolean> => {
  const config = await configRepo.findByLocationId(locationId);
  if (!config) return true;

  return config.product_ids.includes(productId);
};
