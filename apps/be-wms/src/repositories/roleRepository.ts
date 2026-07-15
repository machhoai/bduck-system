import type { Role } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";

const COLLECTION = "roles";

class RoleRepository extends BaseRepository<Role> {
  constructor() {
    super(COLLECTION);
  }

  async findByName(name: string): Promise<Role | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("name", "==", name)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Role;
  }

  async findByIds(roleIds: readonly string[]): Promise<Role[]> {
    const ids = Array.from(new Set(roleIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const snapshots = await db.getAll(
      ...ids.map((id) => db.collection(COLLECTION).doc(id)),
    );
    return snapshots.flatMap((snapshot) => {
      if (!snapshot.exists) return [];
      const role = { ...snapshot.data(), id: snapshot.id } as Role;
      return role.is_deleted === false ? [role] : [];
    });
  }

  async findByParentId(parentId: string | null): Promise<Role[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("parent_id", "==", parentId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Role);
  }

  async hasActiveChildren(roleId: string): Promise<boolean> {
    const children = await this.findByParentId(roleId);
    return children.length > 0;
  }

  async hasActiveAssignments(roleId: string): Promise<boolean> {
    const snapshot = await db
      .collection("user_warehouse_roles")
      .where("role_id", "==", roleId)
      .where("is_active", "==", true)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  async getDescendantIds(roleId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [roleId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      const children = await this.findByParentId(currentId);
      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }
}

export const roleRepository = new RoleRepository();
