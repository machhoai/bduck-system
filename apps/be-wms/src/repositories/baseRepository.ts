import { db } from '../config/firebase.js';
import type { SoftDeletable } from '@bduck/shared-types';

export class BaseRepository<T extends SoftDeletable & { id: string }> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  async findById(id: string): Promise<T | null> {
    const docSnap = await db.collection(this.collectionName).doc(id).get();
    if (!docSnap.exists) {
      return null;
    }
    const data = docSnap.data() as T;
    // By default, we might still want to return it even if deleted, but let's be careful.
    // Usually, specific repos might override this or filter by `is_deleted`.
    return data;
  }

  async findAll(includeDeleted = false): Promise<T[]> {
    let query: FirebaseFirestore.Query = db.collection(this.collectionName);
    
    if (!includeDeleted) {
      query = query.where('is_deleted', '==', false);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as T);
  }

  async create(id: string, data: Omit<T, 'is_deleted' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date();
    const docData = {
      ...data,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    } as unknown as T; // Type assertion

    await db.collection(this.collectionName).doc(id).set(docData);
    return docData;
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>>): Promise<void> {
    const updateData = {
      ...data,
      updated_at: new Date()
    };
    await db.collection(this.collectionName).doc(id).update(updateData);
  }

  /**
   * NO HARD DELETES rule: ISO:9001 compliance
   */
  async softDelete(id: string): Promise<void> {
    await db.collection(this.collectionName).doc(id).update({
      is_deleted: true,
      updated_at: new Date()
    });
  }
}
