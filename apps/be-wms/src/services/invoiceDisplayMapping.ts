import type {
  InvoiceSourceOrderLine,
  MeInvoiceStoreConfig,
} from "@bduck/shared-types";

type DisplayMappingConfig = Pick<
  MeInvoiceStoreConfig,
  | "item_name_mapping"
  | "item_unit_mapping"
  | "unit_name_mapping"
  | "default_unit_name"
>;

const mappedValue = (
  value: string | null,
  mapping: Record<string, string>,
): string | null => {
  if (!value) return null;
  return mapping[value] ?? value;
};

export const applyInvoiceDisplayMapping = <
  T extends Pick<InvoiceSourceOrderLine, "item_name" | "unit_name">,
>(
  line: T,
  config: DisplayMappingConfig,
): T => ({
  ...line,
  item_name: mappedValue(line.item_name, config.item_name_mapping),
  unit_name:
    (line.item_name ? config.item_unit_mapping?.[line.item_name] : undefined) ??
    mappedValue(line.unit_name, config.unit_name_mapping) ??
    config.default_unit_name ??
    null,
});
