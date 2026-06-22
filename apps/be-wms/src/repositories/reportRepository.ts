import type {
  ReportExportRecord,
  ReportTemplate,
  ReportTemplateVersion,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const TEMPLATE_COLLECTION = "report_templates";
const VERSION_COLLECTION = "report_template_versions";
const EXPORT_COLLECTION = "report_exports";

export async function createTemplate(data: ReportTemplate): Promise<void> {
  await db.collection(TEMPLATE_COLLECTION).doc(data.id).set(data);
}

export async function updateTemplate(
  id: string,
  data: Partial<ReportTemplate>,
): Promise<void> {
  const now = new Date();
  await db.collection(TEMPLATE_COLLECTION).doc(id).update({
    ...data,
    updated_at: now,
    action_time: now,
    sync_time: now,
  });
}

export async function findTemplateById(
  id: string,
): Promise<ReportTemplate | null> {
  const snap = await db.collection(TEMPLATE_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const record = snap.data() as ReportTemplate;
  return record.is_deleted ? null : record;
}

export async function findVisibleTemplates(
  userId: string,
): Promise<ReportTemplate[]> {
  const [owned, shared] = await Promise.all([
    db
      .collection(TEMPLATE_COLLECTION)
      .where("owner_id", "==", userId)
      .where("is_deleted", "==", false)
      .get(),
    db
      .collection(TEMPLATE_COLLECTION)
      .where("visibility", "==", "shared")
      .where("is_deleted", "==", false)
      .get(),
  ]);

  const byId = new Map<string, ReportTemplate>();
  for (const doc of [...owned.docs, ...shared.docs]) {
    byId.set(doc.id, doc.data() as ReportTemplate);
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function createVersion(
  data: ReportTemplateVersion,
): Promise<void> {
  await db.collection(VERSION_COLLECTION).doc(data.id).set(data);
}

export async function updateVersion(
  id: string,
  data: Partial<ReportTemplateVersion>,
): Promise<void> {
  const now = new Date();
  await db.collection(VERSION_COLLECTION).doc(id).update({
    ...data,
    updated_at: now,
    action_time: now,
    sync_time: now,
  });
}

export async function findVersionById(
  id: string,
): Promise<ReportTemplateVersion | null> {
  const snap = await db.collection(VERSION_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const record = snap.data() as ReportTemplateVersion;
  return record.is_deleted ? null : record;
}

export async function createExportRecord(
  data: ReportExportRecord,
): Promise<void> {
  await db.collection(EXPORT_COLLECTION).doc(data.id).set(data);
}
