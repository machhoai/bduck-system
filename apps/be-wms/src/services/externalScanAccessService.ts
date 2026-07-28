import { createHash } from "crypto";
import type {
  ExternalScanAccessState,
  IntegrationClient,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { getExternalCountRequirement } from "./externalCountConfigService.js";

const COLLECTION = "external_scan_access";

const accessId = (
  clientId: string,
  warehouseId: string,
  warehouseLocationId: string,
) =>
  createHash("sha256")
    .update(`${clientId}\0${warehouseId}\0${warehouseLocationId}`)
    .digest("hex");

export const externalScanAccessRef = (
  clientId: string,
  warehouseId: string,
  warehouseLocationId: string,
) =>
  db
    .collection(COLLECTION)
    .doc(accessId(clientId, warehouseId, warehouseLocationId));

export const getExternalScanAccess = async (
  clientId: string,
  warehouseId: string,
  warehouseLocationId: string,
): Promise<ExternalScanAccessState | null> => {
  const snapshot = await externalScanAccessRef(
    clientId,
    warehouseId,
    warehouseLocationId,
  ).get();
  return snapshot.exists ? (snapshot.data() as ExternalScanAccessState) : null;
};

export const isOperatorAllowedToScan = async (params: {
  client: IntegrationClient;
  warehouseId: string;
  warehouseLocationId: string;
  operatorId: string | null;
}) => {
  const config = await getExternalCountRequirement();
  if (!config.enabled) {
    return { allowed: true, access: null, enforced: false };
  }

  const access = await getExternalScanAccess(
    params.client.id,
    params.warehouseId,
    params.warehouseLocationId,
  );
  const allowed = Boolean(
    params.operatorId && access?.operator_ids.includes(params.operatorId),
  );
  return { allowed, access, enforced: true };
};
