import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import type { Organization } from "@bduck/shared-types";

const COLLECTION = "organizations";

class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super(COLLECTION);
  }

  async findOrganizations(): Promise<Organization[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }) as Organization)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findByCode(code: string): Promise<Organization | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("code", "==", code)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Organization;
  }
}

export const organizationRepository = new OrganizationRepository();
