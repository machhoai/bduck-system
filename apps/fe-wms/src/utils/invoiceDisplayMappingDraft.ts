export const withInvoiceDisplayMappingDraftValue = (
  current: Record<string, string>,
  source: string,
  target: string,
): Record<string, string> => ({
  ...current,
  [source]: target,
});

export const normalizeInvoiceDisplayMappingDraft = (
  mapping: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(mapping)
      .map(([source, target]) => [source, target.trim()] as const)
      .filter(([, target]) => Boolean(target)),
  );
