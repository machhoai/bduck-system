import type { AuditLog } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const COLLECTION = "audit_logs";

/** Map entity_type → Firestore collection for resolving entity names */
const ENTITY_COLLECTION_MAP: Record<string, string> = {
  products: "products",
  product_categories: "product_categories",
  product_bom: "products",
  inventory: "inventory",
  warehouses: "warehouses",
  warehouse_locations: "warehouse_locations",
  organizations: "organizations",
  roles: "roles",
  users: "users",
  workflow_definitions: "workflow_definitions",
  workflow_versions: "workflow_definitions",
  workflow_instances: "workflow_instances",
  workflow_tasks: "workflow_tasks",
  IMPORT_VOUCHER: "import_vouchers",
  EXPORT_VOUCHER: "export_vouchers",
  TRANSFER_ORDER: "transfer_orders",
  TRANSFER_INTRA: "transfer_orders",
  EXTERNAL_SCAN: "external_scan_queue",
  NONCONFORMITY_REPORT: "nonconformity_reports",
  expenses: "expenses",
  notification_dispatches: "notification_dispatches",
  account_invitations: "account_invitations",
};

/** Fields to try (in order) when resolving an entity's display name */
const ENTITY_NAME_FIELDS = [
  "name",
  "code",
  "voucher_number",
  "title",
  "sku",
  "batch_id",
  "period",
  "full_name",
  "username",
  "email",
  "employee_id",
];

export interface AuditLogSearchParams {
  entity_type?: string;
  entity_id?: string;
  warehouse_id?: string;
  action?: string;
  user_id?: string;
  from?: Date;
  to?: Date;
  limit: number;
  sort_by: "action_time" | "sync_time";
  sort_dir: "asc" | "desc";
  /** RBAC: restrict to these warehouse IDs (undefined = no restriction) */
  allowed_warehouse_ids?: string[];
}

class AuditLogRepository {
  async findAuditLogs(params: AuditLogSearchParams): Promise<AuditLog[]> {
    if (
      params.allowed_warehouse_ids &&
      params.allowed_warehouse_ids.length === 0
    ) {
      return [];
    }

    // If RBAC-scoped to specific warehouses, we need to do warehouse_id IN [...] queries
    if (
      params.allowed_warehouse_ids &&
      params.allowed_warehouse_ids.length > 0
    ) {
      return this.findScopedAuditLogs(params);
    }

    return this.findAllAuditLogs(params);
  }

  private async findAllAuditLogs(
    params: AuditLogSearchParams,
  ): Promise<AuditLog[]> {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .orderBy(params.sort_by, params.sort_dir)
      .limit(params.limit);

    query = this.applyFilters(query, params);

    const snapshot = await query.get();
    const logs = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as AuditLog,
    );

    return this.enrichLogs(logs);
  }

  /**
   * RBAC-scoped query: only return logs belonging to allowed warehouses.
   * Firestore `in` query supports max 30 values, so we split if needed.
   */
  private async findScopedAuditLogs(
    params: AuditLogSearchParams,
  ): Promise<AuditLog[]> {
    const warehouseIds = params.allowed_warehouse_ids!;
    const BATCH_SIZE = 30;
    const allLogs: AuditLog[] = [];

    for (let i = 0; i < warehouseIds.length; i += BATCH_SIZE) {
      const batch = warehouseIds.slice(i, i + BATCH_SIZE);

      let query: FirebaseFirestore.Query = db
        .collection(COLLECTION)
        .where("warehouse_id", "in", batch)
        .orderBy(params.sort_by, params.sort_dir)
        .limit(params.limit);

      query = this.applyFilters(query, params);

      const snapshot = await query.get();
      const logs = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as AuditLog,
      );
      allLogs.push(...logs);
    }

    // Sort merged results and apply limit
    allLogs.sort((a, b) => {
      const aVal = (a as any)[params.sort_by];
      const bVal = (b as any)[params.sort_by];
      const aTime =
        aVal instanceof Date ? aVal.getTime() : new Date(aVal).getTime();
      const bTime =
        bVal instanceof Date ? bVal.getTime() : new Date(bVal).getTime();
      return params.sort_dir === "desc" ? bTime - aTime : aTime - bTime;
    });

    const trimmed = allLogs.slice(0, params.limit);
    return this.enrichLogs(trimmed);
  }

  private applyFilters(
    query: FirebaseFirestore.Query,
    params: AuditLogSearchParams,
  ): FirebaseFirestore.Query {
    if (params.entity_type) {
      query = query.where("entity_type", "==", params.entity_type);
    }
    if (params.entity_id) {
      query = query.where("entity_id", "==", params.entity_id);
    }
    // Only apply warehouse_id filter if explicitly set (not from RBAC scoping)
    if (params.warehouse_id && !params.allowed_warehouse_ids) {
      query = query.where("warehouse_id", "==", params.warehouse_id);
    }
    if (params.action) {
      query = query.where("action", "==", params.action);
    }
    if (params.user_id) {
      query = query.where("user_id", "==", params.user_id);
    }
    if (params.from) {
      query = query.where(params.sort_by, ">=", params.from);
    }
    if (params.to) {
      query = query.where(params.sort_by, "<=", params.to);
    }
    return query;
  }

  /**
   * Enrich logs with user_name and entity_name via batch lookups.
   */
  private async enrichLogs(logs: AuditLog[]): Promise<AuditLog[]> {
    if (logs.length === 0) return logs;

    const [userNameMap, entityNameMap] = await Promise.all([
      this.buildUserNameMap(logs),
      this.buildEntityNameMap(logs),
    ]);

    return logs.map((log) => ({
      ...log,
      user_name: userNameMap.get(log.user_id) || log.user_name || null,
      entity_name:
        log.entity_name ||
        entityNameMap.get(`${log.entity_type}::${log.entity_id}`) ||
        null,
    }));
  }

  private async buildUserNameMap(
    logs: AuditLog[],
  ): Promise<Map<string, string>> {
    const userIds = Array.from(
      new Set(logs.map((log) => log.user_id).filter(Boolean)),
    );
    if (userIds.length === 0) return new Map();

    const userRefs = userIds.map((id) => db.collection("users").doc(id));
    const snapshots = await db.getAll(...userRefs);
    const map = new Map<string, string>();

    for (const snap of snapshots) {
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const name =
        (typeof data.full_name === "string" && data.full_name.trim()) ||
        (typeof data.username === "string" && data.username.trim()) ||
        (typeof data.email === "string" && data.email.trim()) ||
        null;
      if (name) map.set(snap.id, name);
    }

    return map;
  }

  private async buildEntityNameMap(
    logs: AuditLog[],
  ): Promise<Map<string, string>> {
    // Group entity_ids by their collection
    const refsByKey = new Map<string, FirebaseFirestore.DocumentReference>();

    for (const log of logs) {
      const compositeKey = `${log.entity_type}::${log.entity_id}`;
      if (refsByKey.has(compositeKey)) continue;

      const collectionName = ENTITY_COLLECTION_MAP[log.entity_type];
      if (!collectionName) continue;

      refsByKey.set(
        compositeKey,
        db.collection(collectionName).doc(log.entity_id),
      );
    }

    if (refsByKey.size === 0) return new Map();

    const keys = Array.from(refsByKey.keys());
    const refs = Array.from(refsByKey.values());
    const snapshots = await db.getAll(...refs);
    const map = new Map<string, string>();

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!snap.exists) continue;

      const data = snap.data() || {};
      const name = this.extractEntityName(data);
      if (name) map.set(keys[i], name);
    }

    return map;
  }

  private extractEntityName(data: Record<string, unknown>): string | null {
    for (const field of ENTITY_NAME_FIELDS) {
      const value = data[field];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    if (
      typeof data.warehouse_id === "string" &&
      data.warehouse_id.trim() &&
      typeof data.period === "string" &&
      data.period.trim()
    ) {
      return `${data.warehouse_id.trim()} ${data.period.trim()}`;
    }
    return null;
  }
}

export const auditLogRepository = new AuditLogRepository();
