import { WarehouseType } from "@bduck/shared-types";
import { authorizationError } from "./authorizationError.js";
import type { AccessContext } from "./authorizationTypes.js";

const isActionAllowedForFacilityType = (
  action: string,
  facilityType: WarehouseType,
): boolean => {
  if (action.startsWith("revenue.")) {
    return facilityType === WarehouseType.STORE;
  }
  if (action.startsWith("invoices.")) {
    return facilityType === WarehouseType.STORE;
  }
  if (action.startsWith("transfers.")) {
    return (
      facilityType === WarehouseType.MAIN ||
      facilityType === WarehouseType.STORE
    );
  }
  if (
    action.startsWith("inventory.") ||
    action.startsWith("locations.") ||
    action.startsWith("vouchers.") ||
    action.startsWith("stock_counts.") ||
    action.startsWith("external_count.") ||
    action.startsWith("external_scan.")
  ) {
    return (
      facilityType === WarehouseType.MAIN ||
      facilityType === WarehouseType.STORE
    );
  }
  return true;
};

export class AuthorizationService {
  constructor(readonly context: AccessContext) {}

  can(action: string, facilityId: string): boolean {
    if (
      typeof action !== "string" ||
      action.trim().length === 0 ||
      action !== action.trim() ||
      typeof facilityId !== "string" ||
      facilityId.trim().length === 0 ||
      facilityId !== facilityId.trim()
    ) {
      return false;
    }
    const grant = this.context.grants[facilityId];
    if (!grant || !isActionAllowedForFacilityType(action, grant.facilityType)) {
      return false;
    }
    return (
      grant.permissions["*"] === true || grant.permissions[action] === true
    );
  }

  assert(action: string, facilityId: string): void {
    if (!this.can(action, facilityId)) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
  }

  facilityIdsFor(action: string): string[] {
    return Object.keys(this.context.grants)
      .filter((facilityId) => this.can(action, facilityId))
      .sort();
  }

  hasFacilityAccess(facilityId: string): boolean {
    return (
      typeof facilityId === "string" &&
      facilityId.trim() === facilityId &&
      facilityId.length > 0 &&
      this.context.grants[facilityId] !== undefined
    );
  }

  hasRoleAtFacility(roleId: string, facilityId: string): boolean {
    const grant = this.context.grants[facilityId];
    return Boolean(
      grant &&
      roleId.length > 0 &&
      grant.sources.some((source) => source.role_id === roleId),
    );
  }

  assertFacilityAccess(facilityId: string): void {
    if (!this.hasFacilityAccess(facilityId)) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
  }

  canReadTransfer(
    sourceFacilityId: string,
    destinationFacilityId: string,
  ): boolean {
    return (
      this.can("transfers.read", sourceFacilityId) ||
      this.can("transfers.read", destinationFacilityId)
    );
  }

  canWriteTransfer(sourceFacilityId: string): boolean {
    return this.can("transfers.write", sourceFacilityId);
  }

  canReceiveTransfer(destinationFacilityId: string): boolean {
    return this.can("transfers.receive", destinationFacilityId);
  }

  assertCanReadTransfer(
    sourceFacilityId: string,
    destinationFacilityId: string,
  ): void {
    if (!this.canReadTransfer(sourceFacilityId, destinationFacilityId)) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
  }

  assertCanWriteTransfer(sourceFacilityId: string): void {
    this.assert("transfers.write", sourceFacilityId);
  }

  assertCanReceiveTransfer(destinationFacilityId: string): void {
    this.assert("transfers.receive", destinationFacilityId);
  }
}
