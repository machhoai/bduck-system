const relationshipError = {
  statusCode: 400,
  code: "FACILITY_RELATIONSHIP_MISMATCH",
  messages: {
    vi: "Dữ liệu cơ sở, vị trí và tài nguyên không khớp nhau.",
    zh: "设施、库位和资源数据不匹配。",
  },
};

const assertSameIdentifier = (
  expectedId: string,
  actualIds: readonly string[],
): void => {
  if (
    expectedId.trim().length === 0 ||
    actualIds.length === 0 ||
    actualIds.some((actualId) => actualId !== expectedId)
  ) {
    throw relationshipError;
  }
};

export const assertFacilityRelationship = (
  expectedFacilityId: string,
  ...actualFacilityIds: string[]
): void => assertSameIdentifier(expectedFacilityId, actualFacilityIds);

export const assertLocationRelationship = (
  expectedLocationId: string,
  ...actualLocationIds: string[]
): void => assertSameIdentifier(expectedLocationId, actualLocationIds);
