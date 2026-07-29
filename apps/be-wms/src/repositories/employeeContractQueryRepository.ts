import {
  EmployeeContractStatus,
  differenceInContractLocalDays,
  type EmployeeContract,
  type EmployeeContractExpiryView,
  type LocalDate,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  EMPLOYEE_CONTRACTS_COLLECTION,
  EMPLOYEE_PROFILES_COLLECTION,
  employeeContractRef,
  mapEmployeeContractSnapshot,
} from "./employeeContractRepository.js";

export const findEmployeeContractById = async (
  contractId: string,
): Promise<EmployeeContract | null> => {
  const snapshot = await employeeContractRef(contractId).get();
  if (!snapshot.exists) return null;
  const contract = mapEmployeeContractSnapshot(snapshot);
  return contract.is_deleted ? null : contract;
};

export const findEmployeeContractsByProfileId = async (
  employeeProfileId: string,
): Promise<EmployeeContract[]> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACTS_COLLECTION)
    .where("employee_profile_id", "==", employeeProfileId)
    .get();
  return snapshot.docs
    .map(mapEmployeeContractSnapshot)
    .filter((contract) => !contract.is_deleted)
    .sort((left, right) => right.start_date.localeCompare(left.start_date));
};

export const loadEmployeeContractsInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  employeeProfileId: string,
): Promise<EmployeeContract[]> => {
  const snapshot = await transaction.get(
    db
      .collection(EMPLOYEE_CONTRACTS_COLLECTION)
      .where("employee_profile_id", "==", employeeProfileId),
  );
  return snapshot.docs.map(mapEmployeeContractSnapshot);
};

export const findEmployeeContractByNormalizedNumber = async (
  normalizedNumber: string,
): Promise<EmployeeContract | null> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACTS_COLLECTION)
    .where("contract_number_normalized", "==", normalizedNumber)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const contract = mapEmployeeContractSnapshot(snapshot.docs[0]);
  return contract.is_deleted ? null : contract;
};

export const loadEmployeeContractNumberInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  normalizedNumber: string,
): Promise<EmployeeContract | null> => {
  const snapshot = await transaction.get(
    db
      .collection(EMPLOYEE_CONTRACTS_COLLECTION)
      .where("contract_number_normalized", "==", normalizedNumber)
      .limit(1),
  );
  if (snapshot.empty) return null;
  const contract = mapEmployeeContractSnapshot(snapshot.docs[0]);
  return contract.is_deleted ? null : contract;
};

export const findEmployeeContractsForAutomation = async (): Promise<
  EmployeeContract[]
> => {
  const snapshot = await db
    .collection(EMPLOYEE_CONTRACTS_COLLECTION)
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs.map(mapEmployeeContractSnapshot);
};

const chunk = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

export const findExpiringEmployeeContracts = async (
  asOfDate: LocalDate,
  deadline: LocalDate,
  facilityIds: string[] | null,
  limit: number,
): Promise<EmployeeContractExpiryView[]> => {
  if (facilityIds?.length === 0) return [];
  const scopes = facilityIds ? chunk(facilityIds, 30) : [null];
  const contracts: EmployeeContract[] = [];
  const statuses = [
    EmployeeContractStatus.UPCOMING,
    EmployeeContractStatus.ACTIVE,
  ];

  for (const scope of scopes) {
    for (const status of statuses) {
      let query: FirebaseFirestore.Query = db
        .collection(EMPLOYEE_CONTRACTS_COLLECTION)
        .where("status", "==", status)
        .where("is_deleted", "==", false)
        .where("end_date", ">=", asOfDate)
        .where("end_date", "<=", deadline)
        .orderBy("end_date", "asc");
      if (scope) {
        query = query.where("workplace_warehouse_id", "in", scope);
      }
      const snapshot = await query.limit(limit).get();
      contracts.push(...snapshot.docs.map(mapEmployeeContractSnapshot));
    }
  }

  const sorted = contracts
    .sort((left, right) =>
      (left.end_date ?? "").localeCompare(right.end_date ?? ""),
    )
    .slice(0, limit);
  const profileIds = Array.from(
    new Set(sorted.map((contract) => contract.employee_profile_id)),
  );
  const profileSnapshots =
    profileIds.length > 0
      ? await db.getAll(
          ...profileIds.map((id) =>
            db.collection(EMPLOYEE_PROFILES_COLLECTION).doc(id),
          ),
        )
      : [];
  const profiles = new Map(
    profileSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()!]),
  );

  return sorted.map((contract) => {
    const profile = profiles.get(contract.employee_profile_id);
    return {
      ...contract,
      employee_code:
        typeof profile?.employee_code === "string"
          ? profile.employee_code
          : "",
      employee_name:
        typeof profile?.full_name === "string" ? profile.full_name : "",
      days_until_expiry:
        contract.end_date === null
          ? 0
          : (differenceInContractLocalDays(contract.end_date, asOfDate) ?? 0),
    };
  });
};
