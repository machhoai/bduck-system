import { WarehouseType, type User } from "@bduck/shared-types";
import type { AuthorizationSourceSnapshot } from "../services/authorization/authorizationTypes.js";
import {
  AUTHORIZATION_DATE_TIME_ZONE,
  isAuthorizationSourceId,
  mapAuthorizationActor,
  mapAuthorizationAssignments,
  mapAuthorizationFacilities,
  mapAuthorizationOfficeConfig,
  mapAuthorizationOfficeEdges,
  mapAuthorizationRoles,
  mapAuthorizationUserActor,
  type AuthorizationSourceDocument,
} from "./authorizationSourceMapper.js";
import {
  activeDirectFacilityIds,
  activeOfficeEdgeTargetIds,
  activeOfficeScopeMode,
  hasExactGlobalWildcard,
} from "./authorizationSourceReadPolicy.js";

export interface AuthorizationSourceReader {
  getUser(actorId: string): Promise<AuthorizationSourceDocument | null>;
  findProfiles(actorId: string): Promise<AuthorizationSourceDocument[]>;
  findAssignments(actorId: string): Promise<AuthorizationSourceDocument[]>;
  getRoles(roleIds: readonly string[]): Promise<AuthorizationSourceDocument[]>;
  getFacilities(
    facilityIds: readonly string[],
  ): Promise<AuthorizationSourceDocument[]>;
  findAllFacilityCandidates(): Promise<AuthorizationSourceDocument[]>;
  getOfficeConfig(
    officeId: string,
  ): Promise<AuthorizationSourceDocument | null>;
  findOfficeEdges(officeId: string): Promise<AuthorizationSourceDocument[]>;
}

export interface AuthorizationRequestSource {
  snapshot: AuthorizationSourceSnapshot;
  requestUser: User | null;
}

const sortById = <T extends { id: string }>(values: readonly T[]): T[] =>
  [...values].sort((left, right) => left.id.localeCompare(right.id));

const uniqueIds = (values: readonly unknown[]): string[] =>
  Array.from(new Set(values.filter(isAuthorizationSourceId))).sort();

const onlyRequestedDocuments = (
  documents: readonly AuthorizationSourceDocument[],
  ids: readonly string[],
): AuthorizationSourceDocument[] => {
  const requested = new Set(ids);
  return documents.filter((document) => requested.has(document.id));
};

const emptySnapshot = (now: Date): AuthorizationSourceSnapshot => ({
  actor: null,
  facilities: [],
  roles: [],
  assignments: [],
  officeScopeConfigs: [],
  officeScopeEdges: [],
  now: new Date(now),
  dateOnlyTimeZone: AUTHORIZATION_DATE_TIME_ZONE,
});

const isManageableFacility = (type: WarehouseType): boolean =>
  type === WarehouseType.MAIN || type === WarehouseType.STORE;

const mapRequestUser = (
  document: AuthorizationSourceDocument | null,
): User | null =>
  document ? ({ ...document.data, id: document.id } as unknown as User) : null;

const requestSource = (
  snapshot: AuthorizationSourceSnapshot,
  requestUser: User | null,
): AuthorizationRequestSource => ({ snapshot, requestUser });

export const loadAuthorizationRequestSourceFromReader = async (
  reader: AuthorizationSourceReader,
  actorId: string,
  now = new Date(),
): Promise<AuthorizationRequestSource> => {
  const fallback = emptySnapshot(now);
  if (!isAuthorizationSourceId(actorId) || !Number.isFinite(now.getTime())) {
    return requestSource(fallback, null);
  }

  const user = await reader.getUser(actorId);
  const requestUser = mapRequestUser(user);
  const userActor = mapAuthorizationUserActor(actorId, user);
  if (!userActor) return requestSource(fallback, requestUser);

  const assignmentDocuments = await reader.findAssignments(actorId);
  const assignments = sortById(
    mapAuthorizationAssignments(assignmentDocuments).filter(
      (assignment) => assignment.user_id === actorId,
    ),
  );
  const roleIds = uniqueIds(
    assignments.map((assignment) => assignment.role_id),
  );
  const [roleDocuments, profiles] = await Promise.all([
    reader.getRoles(roleIds),
    reader.findProfiles(actorId),
  ]);
  const roles = sortById(
    mapAuthorizationRoles(onlyRequestedDocuments(roleDocuments, roleIds)),
  );
  const sourceBase = {
    roles,
    assignments,
    now: new Date(now),
    dateOnlyTimeZone: AUTHORIZATION_DATE_TIME_ZONE,
  };

  if (hasExactGlobalWildcard(actorId, assignments, roles, now)) {
    return requestSource(
      {
        ...sourceBase,
        actor: userActor,
        facilities: sortById(
          mapAuthorizationFacilities(
            await reader.findAllFacilityCandidates(),
            now,
          ),
        ),
        officeScopeConfigs: [],
        officeScopeEdges: [],
      },
      requestUser,
    );
  }

  const actor = mapAuthorizationActor(actorId, user, profiles);
  if (!actor) return requestSource(fallback, requestUser);
  const baseSnapshot = { ...sourceBase, actor };

  const directFacilityIds = activeDirectFacilityIds(actorId, assignments, now);
  if (isAuthorizationSourceId(actor.workplace_facility_id)) {
    directFacilityIds.push(actor.workplace_facility_id);
  }
  const requestedDirectIds = uniqueIds(directFacilityIds);
  const directDocuments = onlyRequestedDocuments(
    await reader.getFacilities(requestedDirectIds),
    requestedDirectIds,
  );
  const facilities = new Map(
    mapAuthorizationFacilities(directDocuments, now).map((facility) => [
      facility.id,
      facility,
    ]),
  );

  const workplace = isAuthorizationSourceId(actor.workplace_facility_id)
    ? facilities.get(actor.workplace_facility_id)
    : null;
  if (!workplace || workplace.type !== WarehouseType.OFFICE) {
    return requestSource(
      {
        ...baseSnapshot,
        facilities: sortById(Array.from(facilities.values())),
        officeScopeConfigs: [],
        officeScopeEdges: [],
      },
      requestUser,
    );
  }

  const [configDocument, edgeDocuments] = await Promise.all([
    reader.getOfficeConfig(workplace.id),
    reader.findOfficeEdges(workplace.id),
  ]);
  const config = mapAuthorizationOfficeConfig(configDocument);
  const edges = sortById(
    mapAuthorizationOfficeEdges(edgeDocuments).filter(
      (edge) => edge.office_id === workplace.id,
    ),
  );
  const mode = activeOfficeScopeMode(config, workplace.id, now);

  if (mode === "ALL") {
    mapAuthorizationFacilities(await reader.findAllFacilityCandidates(), now)
      .filter((facility) => isManageableFacility(facility.type))
      .forEach((facility) => facilities.set(facility.id, facility));
  } else if (mode === "SELECTED") {
    const targetIds = activeOfficeEdgeTargetIds(edges, workplace.id, now);
    const targetDocuments = onlyRequestedDocuments(
      await reader.getFacilities(targetIds),
      targetIds,
    );
    mapAuthorizationFacilities(targetDocuments, now)
      .filter((facility) => isManageableFacility(facility.type))
      .forEach((facility) => facilities.set(facility.id, facility));
  }

  return requestSource(
    {
      ...baseSnapshot,
      facilities: sortById(Array.from(facilities.values())),
      officeScopeConfigs: config ? [config] : [],
      officeScopeEdges: edges,
    },
    requestUser,
  );
};

export const loadAuthorizationSourceSnapshotFromReader = async (
  reader: AuthorizationSourceReader,
  actorId: string,
  now = new Date(),
): Promise<AuthorizationSourceSnapshot> =>
  (await loadAuthorizationRequestSourceFromReader(reader, actorId, now))
    .snapshot;
